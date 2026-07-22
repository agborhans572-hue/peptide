import type { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { errorResponse, json } from './_shared/http.ts'
import { reportOperationalError, reportOperationalEvent } from './_shared/monitor.ts'
import { webhookEnv } from './_shared/env.ts'
import { createClient } from '@supabase/supabase-js'

export const handler: Handler = async (request) => {
  let monitoringWebhook: string | undefined
  try {
    if (request.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })
    const env = webhookEnv()
    monitoringWebhook = env.MONITORING_WEBHOOK_URL
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const signature = request.headers['stripe-signature']
    if (!signature || !request.body) return json(400, { message: 'Missing Stripe signature.' })
    const rawBody = request.isBase64Encoded
      ? Buffer.from(request.body, 'base64').toString('utf8')
      : request.body
    const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object
      if (session.payment_status !== 'paid') return json(200, { received: true, pending: true })
      const { data, error } = await supabase.rpc('record_paid_checkout', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_livemode: event.livemode,
        p_order_id: session.metadata?.order_id || session.client_reference_id,
        p_session_id: session.id,
        p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        p_customer_email: session.customer_details?.email || null,
        p_customer_name: session.customer_details?.name || null,
        p_customer_phone: session.customer_details?.phone || null,
        p_shipping_address: session.collected_information?.shipping_details?.address || session.customer_details?.address || null,
        p_amount_subtotal: session.amount_subtotal || 0,
        p_amount_total: session.amount_total || 0,
        p_currency: session.currency || 'usd',
      })
      if (error) throw error
      if (data) await reportOperationalEvent(monitoringWebhook, 'payment.succeeded', { orderId: session.metadata?.order_id, paymentIntentId: session.payment_intent })
      return json(200, { received: true, processed: data })
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
      const { data, error } = await supabase.rpc('record_refund', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_livemode: event.livemode,
        p_payment_intent_id: paymentIntentId,
        p_amount_refunded: charge.amount_refunded,
      })
      if (error) throw error
      await reportOperationalEvent(monitoringWebhook, 'payment.refunded', { paymentIntentId })
      return json(200, { received: true, processed: data })
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object
      const { error } = await supabase.rpc('record_payment_failure', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_livemode: event.livemode,
        p_payment_intent_id: intent.id,
        p_order_id: intent.metadata.order_id || null,
      })
      if (error) throw error
      await reportOperationalError(monitoringWebhook, 'payment.failed', intent.last_payment_error?.message || 'Payment failed', { paymentIntentId: intent.id })
      return json(200, { received: true })
    }

    const { error } = await supabase.rpc('record_stripe_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_livemode: event.livemode,
    })
    if (error) throw error
    return json(200, { received: true })
  } catch (error) {
    const isSignatureError = error instanceof Stripe.errors.StripeSignatureVerificationError
    await reportOperationalError(monitoringWebhook, 'stripe.webhook_failed', error)
    return isSignatureError ? json(400, { message: 'Invalid Stripe signature.' }) : errorResponse(error)
  }
}
