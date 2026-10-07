import type { Handler } from '@netlify/functions'
import type Stripe from 'stripe'
import { z } from 'zod'
import { catalogVersion, priceCart } from '../../server/pricing.js'
import { optionalActiveCustomer } from './_shared/customer-auth.js'
import { clientFingerprint, errorResponse, HttpError, json, parseJson, requireSameOrigin } from './_shared/http.js'
import { fingerprint, services } from './_shared/services.js'
import { cancelWooOrder, reserveWooOrder } from './_shared/woo-bridge.js'

const checkoutRequest = z.object({
  checkoutAttemptId: z.string().uuid(),
  catalogVersion: z.string().min(10).max(80),
  items: z.array(z.object({
    productId: z.string().min(1).max(80),
    variantId: z.string().min(1).max(80),
    quantity: z.number().int().positive().max(100),
  })).min(1).max(25),
})

type PendingOrder = {
  id: string
  order_number: string
  stripe_checkout_url?: string | null
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })
    const { env, stripe, supabase } = services()
    requireSameOrigin(event, env.SITE_URL)
    if (env.COMMERCE_RESERVATIONS_ENABLED !== 'true') {
      throw new HttpError(503, 'Secure inventory reservations are temporarily unavailable.', 'reservations_disabled', undefined, true)
    }
    const customer = await optionalActiveCustomer(event, supabase)

    const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', {
      p_scope: 'checkout',
      p_client_hash: fingerprint(clientFingerprint(event)),
      p_limit: 12,
      p_window_seconds: 900,
    })
    if (rateError) throw rateError
    if (!allowed) throw new HttpError(429, 'Too many checkout attempts. Please try again later.')

    const backlogCutoff = new Date(Date.now() - 5 * 60_000).toISOString()
    const { data: staleEvents, error: backlogError } = await (supabase as any)
      .from('stripe_event_inbox')
      .select('stripe_event_id')
      .in('status', ['pending', 'processing', 'retry', 'dead'])
      .lt('received_at', backlogCutoff)
      .limit(1)
    if (backlogError) throw backlogError
    if (staleEvents?.length) {
      throw new HttpError(503, 'Checkout is paused while recent payments synchronize. Please try again shortly.', 'commerce_backlog', undefined, true)
    }

    const request = parseJson(event, checkoutRequest)
    if (request.catalogVersion !== catalogVersion) {
      throw new HttpError(409, 'The catalog changed. Refresh your cart before checkout.', 'catalog_changed')
    }
    const cart = priceCart(request.items)

    const { data: existingAttempt, error: existingError } = await supabase
      .from('orders')
      .select('id,order_number,payment_status,reservation_expires_at,stripe_checkout_url')
      .eq('checkout_attempt_id', request.checkoutAttemptId)
      .maybeSingle()
    if (existingError) throw existingError
    if (existingAttempt?.stripe_checkout_url
      && existingAttempt.payment_status === 'pending'
      && new Date(existingAttempt.reservation_expires_at).getTime() > Date.now()) {
      return json(200, {
        checkoutUrl: existingAttempt.stripe_checkout_url,
        orderNumber: existingAttempt.order_number,
        expiresAt: existingAttempt.reservation_expires_at,
        replayed: true,
      })
    }
    if (existingAttempt) {
      throw new HttpError(409, 'This checkout attempt is no longer active. Refresh your cart and try again.', 'checkout_attempt_closed')
    }

    const reservation = await reserveWooOrder(env, {
      catalogVersion,
      checkoutAttemptId: request.checkoutAttemptId,
      currency: cart.currency,
      items: cart.items,
      shippingCents: cart.shippingCents,
      subtotalCents: cart.subtotalCents,
      totalCents: cart.totalCents,
    })
    if (!reservation.expiresAt || reservation.totalCents !== cart.totalCents) {
      throw new HttpError(409, 'The authoritative order total changed. Refresh your cart before checkout.', 'catalog_changed')
    }

    let pendingOrder: PendingOrder | null = null
    try {
      const { data: pendingOrderData, error: orderError } = await (supabase as any).rpc('create_reserved_order', {
        p_checkout_attempt_id: request.checkoutAttemptId,
        p_woo_order_id: reservation.wooOrderId,
        p_reservation_expires_at: reservation.expiresAt,
        p_catalog_version: catalogVersion,
        p_currency: cart.currency,
        p_subtotal_cents: cart.subtotalCents,
        p_shipping_cents: cart.shippingCents,
        p_total_cents: cart.totalCents,
        p_items: cart.items,
        p_user_id: customer?.user.id || null,
      }).single()
      pendingOrder = pendingOrderData as PendingOrder | null
      if (orderError || !pendingOrder) throw orderError || new Error('Order creation failed.')
      if (pendingOrder.stripe_checkout_url) {
        return json(200, {
          checkoutUrl: pendingOrder.stripe_checkout_url,
          orderNumber: pendingOrder.order_number,
          expiresAt: reservation.expiresAt,
          replayed: true,
        })
      }
    } catch (error) {
      await cancelWooOrder(env, reservation.wooOrderId, {
        reason: 'Supabase order projection could not be created.',
      }).catch((cancelError) => console.error(JSON.stringify({ event: 'reservation.compensation_failed', error: String(cancelError), wooOrderId: reservation.wooOrderId })))
      throw error
    }

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
        ...(customer?.user.email ? { customer_email: customer.user.email } : {}),
        customer_creation: 'always',
        consent_collection: { terms_of_service: 'required' },
        custom_text: {
          submit: { message: 'By paying, you confirm the products are solely for qualified in vitro laboratory research and not for human or veterinary use.' },
        },
        success_url: `${origin}/order-confirmation/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/shop/?checkout=cancelled`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata: {
          checkout_attempt_id: request.checkoutAttemptId,
          order_id: pendingOrder.id,
          order_number: pendingOrder.order_number,
          woo_order_id: String(reservation.wooOrderId),
        },
        payment_intent_data: {
          metadata: {
            checkout_attempt_id: request.checkoutAttemptId,
            order_id: pendingOrder.id,
            order_number: pendingOrder.order_number,
            woo_order_id: String(reservation.wooOrderId),
          },
        },
      }, { idempotencyKey: `checkout-${request.checkoutAttemptId}` })

      const { error: linkError } = await (supabase as any).rpc('attach_reserved_checkout', {
        p_order_id: pendingOrder.id,
        p_session_id: session.id,
        p_checkout_url: session.url,
      })
      if (linkError) throw linkError
      return json(200, {
        checkoutUrl: session.url,
        orderNumber: pendingOrder.order_number,
        expiresAt: reservation.expiresAt,
      })
    } catch (error) {
      await supabase.rpc('fail_pending_order', { p_order_id: pendingOrder.id })
      await cancelWooOrder(env, reservation.wooOrderId, {
        reason: 'Stripe Checkout session creation failed.',
      }).catch(async (cancelError) => {
        console.error(JSON.stringify({ event: 'reservation.compensation_failed', error: String(cancelError), wooOrderId: reservation.wooOrderId }))
        await (supabase as any).rpc('enqueue_commerce_job', {
          p_job_type: 'cancel_reservation',
          p_dedupe_key: `cancel-order-${pendingOrder?.id}`,
          p_aggregate_id: pendingOrder?.id,
          p_payload: { orderId: pendingOrder?.id, reason: 'stripe_session_failed', wooOrderId: reservation.wooOrderId },
        }).catch(() => undefined)
      })
      throw error
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'checkout.failed', message: error instanceof Error ? error.message : String(error) }))
    return errorResponse(error)
  }
}
