import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { cancelWooOrder, completeWooPayment, refundWooOrder } from './woo-bridge.ts'

type CommerceEnvironment = {
  COMMERCE_RESERVATIONS_ENABLED: 'true' | 'false'
  WOOCOMMERCE_URL: string
  WOO_BRIDGE_SECRET_CURRENT?: string
}

type ProjectedOrder = {
  id: string
  payment_status: string
  stripe_checkout_session_id: string | null
  total_cents: number
  woo_order_id: number | null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function splitName(name: string | null | undefined) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return { first_name: parts.shift() || '', last_name: parts.join(' ') }
}

function addressRecord(
  address: Stripe.Address | null | undefined,
  name?: string | null,
  email?: string | null,
  phone?: string | null,
) {
  const names = splitName(name)
  return {
    ...names,
    address_1: address?.line1 || '',
    address_2: address?.line2 || '',
    city: address?.city || '',
    state: address?.state || '',
    postcode: address?.postal_code || '',
    country: address?.country || 'US',
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  }
}

async function orderById(supabase: SupabaseClient, orderId: string | null | undefined) {
  if (!orderId) return null
  const { data, error } = await supabase
    .from('orders')
    .select('id,payment_status,stripe_checkout_session_id,total_cents,woo_order_id')
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw error
  return data as ProjectedOrder | null
}

async function markSynchronized(supabase: SupabaseClient, orderId: string) {
  const { error } = await supabase
    .from('orders')
    .update({ last_synced_at: new Date().toISOString(), sync_status: 'synced' })
    .eq('id', orderId)
  if (error) throw error
}

async function processPaidSession(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  env: CommerceEnvironment,
  supabase: SupabaseClient,
) {
  if (session.payment_status !== 'paid') return
  const order = await orderById(supabase, session.metadata?.order_id || session.client_reference_id)
  if (!order) throw new Error('Paid checkout does not match a projected order.')

  const shippingDetails = session.collected_information?.shipping_details
  if (env.COMMERCE_RESERVATIONS_ENABLED === 'true' && order.woo_order_id) {
    await completeWooPayment(env, order.woo_order_id, {
      amountTotal: session.amount_total || 0,
      customer: {
        billing: addressRecord(
          session.customer_details?.address,
          session.customer_details?.name,
          session.customer_details?.email,
          session.customer_details?.phone,
        ),
        shipping: addressRecord(
          shippingDetails?.address || session.customer_details?.address,
          shippingDetails?.name || session.customer_details?.name,
        ),
      },
      eventId: event.id,
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      sessionId: session.id,
    })
  }

  const { error } = await supabase.rpc('record_paid_checkout', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_livemode: event.livemode,
    p_order_id: order.id,
    p_session_id: session.id,
    p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    p_customer_email: session.customer_details?.email || null,
    p_customer_name: session.customer_details?.name || null,
    p_customer_phone: session.customer_details?.phone || null,
    p_shipping_address: shippingDetails?.address || session.customer_details?.address || null,
    p_amount_subtotal: session.amount_subtotal || 0,
    p_amount_total: session.amount_total || 0,
    p_currency: session.currency || 'usd',
  })
  if (error) throw error
  await markSynchronized(supabase, order.id)
  console.info(JSON.stringify({ event: 'payment.succeeded', orderId: order.id, stripeEventId: event.id, wooOrderId: order.woo_order_id }))
}

async function processClosedSession(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  env: CommerceEnvironment,
  supabase: SupabaseClient,
) {
  const order = await orderById(supabase, session.metadata?.order_id || session.client_reference_id)
  if (!order) return
  if (order.payment_status !== 'pending') {
    const { error } = await supabase.rpc('record_stripe_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_livemode: event.livemode,
    })
    if (error) throw error
    return
  }
  if (order.woo_order_id && env.COMMERCE_RESERVATIONS_ENABLED === 'true') {
    await cancelWooOrder(env, order.woo_order_id, { eventId: event.id, reason: `Stripe ${event.type}` })
  }
  const { error } = await supabase.rpc('record_checkout_expired', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_livemode: event.livemode,
    p_order_id: order.id,
    p_session_id: session.id,
  })
  if (error) throw error
  await markSynchronized(supabase, order.id)
}

async function processPaymentFailure(
  event: Stripe.Event,
  intent: Stripe.PaymentIntent,
  env: CommerceEnvironment,
  supabase: SupabaseClient,
) {
  const order = await orderById(supabase, intent.metadata.order_id)
  if (order?.woo_order_id && order.payment_status === 'pending' && env.COMMERCE_RESERVATIONS_ENABLED === 'true') {
    await cancelWooOrder(env, order.woo_order_id, { eventId: event.id, reason: 'Stripe payment failed.' })
  }
  const { error } = await supabase.rpc('record_payment_failure', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_livemode: event.livemode,
    p_payment_intent_id: intent.id,
    p_order_id: order?.id || intent.metadata.order_id || null,
  })
  if (error) throw error
  if (order) await markSynchronized(supabase, order.id)
  console.error(JSON.stringify({ event: 'payment.failed', orderId: order?.id, stripeEventId: event.id }))
}

async function processRefund(
  event: Stripe.Event,
  charge: Stripe.Charge,
  env: CommerceEnvironment,
  supabase: SupabaseClient,
) {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
  const { data, error: lookupError } = await supabase
    .from('orders')
    .select('id,woo_order_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (data?.woo_order_id && env.COMMERCE_RESERVATIONS_ENABLED === 'true') {
    await refundWooOrder(env, Number(data.woo_order_id), { amountRefunded: charge.amount_refunded, eventId: event.id })
  }
  const { error } = await supabase.rpc('record_refund', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_livemode: event.livemode,
    p_payment_intent_id: paymentIntentId,
    p_amount_refunded: charge.amount_refunded,
  })
  if (error) throw error
  if (data?.id) await markSynchronized(supabase, data.id)
  console.info(JSON.stringify({ event: 'payment.refunded', orderId: data?.id, stripeEventId: event.id }))
}

export async function processStripeEvent(
  event: Stripe.Event,
  env: CommerceEnvironment,
  supabase: SupabaseClient,
) {
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await processPaidSession(event, event.data.object, env, supabase)
    return
  }
  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    await processClosedSession(event, event.data.object, env, supabase)
    return
  }
  if (event.type === 'payment_intent.payment_failed') {
    await processPaymentFailure(event, event.data.object, env, supabase)
    return
  }
  if (event.type === 'charge.refunded') {
    await processRefund(event, event.data.object, env, supabase)
    return
  }
  const { error } = await supabase.rpc('record_stripe_event', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_livemode: event.livemode,
  })
  if (error) throw error
}

export async function retryStripeEvent(supabase: SupabaseClient, eventId: string, error: unknown) {
  const { error: retryError } = await supabase.rpc('retry_stripe_event', {
    p_event_id: eventId,
    p_error: errorMessage(error),
  })
  if (retryError) console.error(JSON.stringify({ event: 'stripe.retry_record_failed', message: retryError.message, stripeEventId: eventId }))
}
