import type { Handler } from '@netlify/functions'
import type Stripe from 'stripe'
import { z } from 'zod'
import { catalogVersion, priceCart } from '../../server/pricing.ts'
import { clientFingerprint, errorResponse, HttpError, json, parseJson, requireSameOrigin } from './_shared/http.ts'
import { reportOperationalError } from './_shared/monitor.ts'
import { fingerprint, services } from './_shared/services.ts'
import { revalidateWooCart } from './_shared/woocommerce.ts'

const checkoutRequest = z.object({
  catalogVersion: z.string().min(10).max(80),
  items: z.array(z.object({
    productId: z.string().min(1).max(80),
    variantId: z.string().min(1).max(80),
    quantity: z.number().int().positive().max(100),
  })).min(1).max(25),
})

export const handler: Handler = async (event) => {
  let monitoringWebhook: string | undefined
  try {
    if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })
    const { env, stripe, supabase } = services()
    monitoringWebhook = env.MONITORING_WEBHOOK_URL
    requireSameOrigin(event, env.SITE_URL)

    const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', {
      p_scope: 'checkout',
      p_client_hash: fingerprint(clientFingerprint(event)),
      p_limit: 12,
      p_window_seconds: 900,
    })
    if (rateError) throw rateError
    if (!allowed) throw new HttpError(429, 'Too many checkout attempts. Please try again later.')

    const request = parseJson(event, checkoutRequest)
    if (request.catalogVersion !== catalogVersion) {
      throw new HttpError(409, 'The catalog changed. Refresh your cart before checkout.', 'catalog_changed')
    }
    await revalidateWooCart(env, request.items)
    const cart = priceCart(request.items)
    const { data: pendingOrderData, error: orderError } = await supabase.rpc('create_pending_order', {
      p_currency: cart.currency,
      p_subtotal_cents: cart.subtotalCents,
      p_shipping_cents: cart.shippingCents,
      p_total_cents: cart.totalCents,
      p_items: cart.items,
    }).single()
    const pendingOrder = pendingOrderData as { id: string, order_number: string } | null
    if (orderError || !pendingOrder) throw orderError || new Error('Order creation failed.')

    const origin = new URL(env.SITE_URL).origin
    const stripeItems: Stripe.Checkout.SessionCreateParams.LineItem[] = cart.items.map((item) => ({
      quantity: 1,
      price_data: {
        currency: cart.currency,
        unit_amount: item.totalCents,
        product_data: {
          name: `${item.quantity} × ${item.productName} — ${item.option}`,
          images: [`${origin}${item.image}`],
          metadata: { product_id: item.productId, variant_id: item.variantId, sku: item.sku, option: item.option },
        },
      },
    }))
    if (cart.shippingCents > 0) {
      stripeItems.push({
        quantity: 1,
        price_data: {
          currency: cart.currency,
          unit_amount: cart.shippingCents,
          product_data: { name: 'USPS Priority Mail', images: [], metadata: {} },
        },
      })
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: pendingOrder.id,
        line_items: stripeItems,
        billing_address_collection: 'required',
        shipping_address_collection: { allowed_countries: ['US'] },
        phone_number_collection: { enabled: true },
        customer_creation: 'always',
        consent_collection: { terms_of_service: 'required' },
        custom_text: {
          submit: { message: 'By paying, you confirm the products are solely for qualified in vitro laboratory research and not for human or veterinary use.' },
        },
        success_url: `${origin}/order-confirmation/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/shop/?checkout=cancelled`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata: { order_id: pendingOrder.id, order_number: pendingOrder.order_number },
        payment_intent_data: { metadata: { order_id: pendingOrder.id, order_number: pendingOrder.order_number } },
      }, { idempotencyKey: `checkout-${pendingOrder.id}` })

      const { error: linkError } = await supabase.rpc('attach_stripe_session', {
        p_order_id: pendingOrder.id,
        p_session_id: session.id,
      })
      if (linkError) throw linkError
      return json(200, { checkoutUrl: session.url })
    } catch (error) {
      await supabase.rpc('fail_pending_order', { p_order_id: pendingOrder.id })
      throw error
    }
  } catch (error) {
    await reportOperationalError(monitoringWebhook, 'checkout.failed', error)
    return errorResponse(error)
  }
}
