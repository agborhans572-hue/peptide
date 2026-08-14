import type { Handler } from '@netlify/functions'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { errorResponse, json } from './_shared/http.ts'
import { webhookEnv } from './_shared/env.ts'
import { createClient } from '@supabase/supabase-js'
import { processStripeEvent, retryStripeEvent } from './_shared/commerce-events.ts'

export const handler: Handler = async (request) => {
  let eventId = ''
  let supabase: ReturnType<typeof createClient> | undefined
  try {
    if (request.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })
    const env = webhookEnv()
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const signature = request.headers['stripe-signature']
    if (!signature || !request.body) return json(400, { message: 'Missing Stripe signature.' })
    const rawBody = request.isBase64Encoded
      ? Buffer.from(request.body, 'base64').toString('utf8')
      : request.body
    const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
    eventId = event.id
    const { error: inboxError } = await (supabase as any).rpc('enqueue_stripe_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_livemode: event.livemode,
      p_payload: event,
    })
    if (inboxError) throw inboxError
    const { data: inboxData, error: inboxLookupError } = await (supabase as any)
      .from('stripe_event_inbox')
      .select('status')
      .eq('stripe_event_id', event.id)
      .single()
    if (inboxLookupError) throw inboxLookupError
    const inbox = inboxData as { status: string }
    if (inbox.status === 'completed') return json(200, { received: true, replayed: true })
    const { data: claimedEvent, error: claimError } = await (supabase as any)
      .rpc('claim_stripe_event', {
        p_event_id: event.id,
        p_worker_id: `webhook-${randomUUID()}`,
        p_lease_seconds: 120,
      })
      .maybeSingle()
    if (claimError) throw claimError
    if (!claimedEvent) return json(200, { received: true, processing: true })

    await processStripeEvent(event, env, supabase)
    const { error: completeError } = await (supabase as any).rpc('complete_stripe_event', { p_event_id: event.id })
    if (completeError) throw completeError
    return json(200, { received: true, processed: true })
  } catch (error) {
    const isSignatureError = error instanceof Stripe.errors.StripeSignatureVerificationError
    if (eventId && supabase) await retryStripeEvent(supabase, eventId, error)
    console.error(JSON.stringify({ event: 'stripe.webhook_failed', message: error instanceof Error ? error.message : String(error), stripeEventId: eventId || undefined }))
    return isSignatureError ? json(400, { message: 'Invalid Stripe signature.' }) : errorResponse(error)
  }
}
