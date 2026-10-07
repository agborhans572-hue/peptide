import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { orderEmail, STORE_MAILBOX, type ManualOrder } from '../../../server/manual-orders.ts'
import { sendResendEmail } from '../../../server/resend-mail.ts'

export function manualServices() {
  const env = z.object({ SITE_URL: z.string().url(), SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(30), RESEND_API_KEY: z.string().startsWith('re_').min(10),
    ORDER_EMAIL_FROM: z.string().email().default('orders@purehealthpeptidesshop.com'),
    TURNSTILE_SECRET_KEY: z.string().min(1), CRON_SECRET: z.string().min(32).optional(),
    MONITORING_WEBHOOK_URL: z.string().url().optional(),
  }).parse(process.env)
  return { env, supabase: createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) }
}

export async function deliverOrderEmails(orderId?: string) {
  const { env, supabase } = manualServices()
  const { data: jobs, error } = await supabase.rpc('claim_order_emails', { p_order_id: orderId || null })
  if (error) throw error
  for (const job of jobs || []) {
    const { data: order, error: readError } = await supabase.from('manual_order_requests').select('*').eq('id', job.order_id).single()
    let sent = false
    if (!readError && order) {
      try {
        const payload = order.payload as ManualOrder
        await sendResendEmail(env.RESEND_API_KEY, job.id, { from: env.ORDER_EMAIL_FROM, to: job.audience === 'store' ? STORE_MAILBOX : payload.customer.email,
          reply_to: job.audience === 'store' ? payload.customer.email : STORE_MAILBOX,
          ...orderEmail(payload, order.order_number, order.created_at, job.audience) })
        sent = true
      } catch { /* Retry without logging customer details or provider credentials. */ }
    }
    const { error: finishError } = await supabase.rpc('finish_order_email', { p_id: job.id, p_claim: job.claim_token, p_sent: sent })
    if (finishError) throw finishError
  }
  const { count, error: countError } = await supabase.from('manual_order_emails').select('id', { count: 'exact', head: true }).eq('status', 'dead')
  if (countError) throw countError
  const { count: delayed, error: delayedError } = await supabase.from('manual_order_emails')
    .select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing'])
    .lt('next_attempt_at', new Date(Date.now() - 10 * 60_000).toISOString())
  if (delayedError) throw delayedError
  if (count || delayed) {
    console.warn(JSON.stringify({ event: 'order_email.delivery_attention', failed: count, delayed }))
    if (!env.MONITORING_WEBHOOK_URL) return
    const response = await fetch(env.MONITORING_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'order_email.delivery_attention', failed: count, delayed }), signal: AbortSignal.timeout(3000) })
    if (!response.ok) throw new Error('Order email alert failed.')
  }
}
