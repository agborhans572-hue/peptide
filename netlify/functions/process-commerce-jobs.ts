import { randomUUID } from 'node:crypto'
import type { Handler } from '@netlify/functions'
import type Stripe from 'stripe'
import { processStripeEvent, retryStripeEvent } from './_shared/commerce-events.js'
import { cronSecret } from './_shared/env.js'
import { errorResponse, json } from './_shared/http.js'
import { services } from './_shared/services.js'
import { cancelWooOrder, getWooOrder } from './_shared/woo-bridge.js'

type StripeInboxRow = {
  payload: Stripe.Event
  stripe_event_id: string
}

type CommerceJob = {
  aggregate_id: string
  id: number
  job_type: 'cancel_reservation' | 'reconcile_order'
  payload: {
    orderId?: string
    reason?: string
    wooOrderId?: number
  }
}

function authorized(header: string | undefined, secret: string) {
  return header === `Bearer ${secret}`
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function inBatches<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      await worker(item)
    }
  }))
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })
    const secret = cronSecret()
    if (!authorized(event.headers.authorization, secret)) return json(401, { message: 'Cron authorization failed.' })

    const workerId = `commerce-${randomUUID()}`
    const { env, supabase } = services()
    const results = { eventsCompleted: 0, eventsRetried: 0, jobsCompleted: 0, jobsRetried: 0 }

    const { error: enqueueError } = await supabase.rpc('enqueue_expired_checkout_jobs', { p_limit: 100 })
    if (enqueueError) throw enqueueError
    const { error: reconcileEnqueueError } = await (supabase as any).rpc('enqueue_reconciliation_jobs', { p_limit: 100 })
    if (reconcileEnqueueError) throw reconcileEnqueueError

    const { data: eventRows, error: claimEventError } = await supabase.rpc('claim_stripe_events', {
      p_worker_id: workerId,
      p_limit: 100,
      p_lease_seconds: 120,
    })
    if (claimEventError) throw claimEventError
    await inBatches((eventRows || []) as StripeInboxRow[], 5, async (row) => {
      try {
        await processStripeEvent(row.payload, env, supabase)
        const { error } = await supabase.rpc('complete_stripe_event', { p_event_id: row.stripe_event_id })
        if (error) throw error
        results.eventsCompleted += 1
      } catch (error) {
        await retryStripeEvent(supabase, row.stripe_event_id, error)
        results.eventsRetried += 1
      }
    })

    const { data: jobRows, error: claimJobError } = await supabase.rpc('claim_commerce_jobs', {
      p_worker_id: workerId,
      p_limit: 100,
      p_lease_seconds: 120,
    })
    if (claimJobError) throw claimJobError
    await inBatches((jobRows || []) as CommerceJob[], 5, async (job) => {
      try {
        const wooOrderId = Number(job.payload.wooOrderId)
        if (!Number.isInteger(wooOrderId) || wooOrderId < 1) throw new Error('Commerce job has no valid Woo order ID.')
        if (job.job_type === 'cancel_reservation') {
          await cancelWooOrder(env, wooOrderId, { reason: job.payload.reason || 'Reservation cleanup' })
          if (job.payload.orderId) {
            const { error } = await supabase.rpc('mark_order_expired', { p_order_id: job.payload.orderId })
            if (error) throw error
          }
        } else {
          const woo = await getWooOrder(env, wooOrderId)
          const { data: applied, error } = await (supabase as any).rpc('apply_woo_order_projection', {
            p_woo_order_id: wooOrderId,
            p_woo_status: woo.status,
            p_total_cents: woo.totalCents,
          })
          if (error) throw error
          if (!applied) throw new Error('Woo order has no matching Supabase projection.')
          const { data: projection, error: projectionError } = await supabase
            .from('orders')
            .select('sync_status')
            .eq('id', job.aggregate_id)
            .single()
          if (projectionError) throw projectionError
          if (projection.sync_status === 'failed') throw new Error('Woo and Supabase order totals do not match.')
        }
        const { error } = await supabase.rpc('complete_commerce_job', { p_job_id: job.id })
        if (error) throw error
        results.jobsCompleted += 1
      } catch (error) {
        const { error: retryError } = await supabase.rpc('retry_commerce_job', {
          p_job_id: job.id,
          p_error: message(error),
        })
        if (retryError) console.error(JSON.stringify({ event: 'commerce_job.retry_failed', jobId: job.id, message: retryError.message }))
        results.jobsRetried += 1
      }
    })

    const { error: cleanupError } = await supabase.rpc('cleanup_scalability_state')
    if (cleanupError) throw cleanupError
    console.info(JSON.stringify({ event: 'commerce_worker.completed', workerId, ...results }))
    return json(200, { workerId, ...results })
  } catch (error) {
    console.error(JSON.stringify({ event: 'commerce_worker.failed', message: message(error) }))
    return errorResponse(error)
  }
}
