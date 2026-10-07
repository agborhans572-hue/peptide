import type { Handler } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { orderRequestSchema, prepareOrder } from '../../server/manual-orders.ts'
import { clientFingerprint, errorResponse, HttpError, json, parseJson, requireSameOrigin } from './_shared/http.ts'
import { deliverOrderEmails, manualServices } from './_shared/manual-orders.ts'

export const handler: Handler = async event => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })
    const { env, supabase } = manualServices()
    requireSameOrigin(event, env.SITE_URL)
    const input = parseJson(event, orderRequestSchema)
    const { data: allowed, error: rateError } = await supabase.rpc('consume_manual_order_rate_limit', {
      p_client_hash: createHash('sha256').update(clientFingerprint(event)).digest('hex'),
    })
    if (rateError) throw rateError
    if (!allowed) throw new HttpError(429, 'Too many requests. Please try again later.')
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: input.captchaToken }), signal: AbortSignal.timeout(5000),
    })
    const challenge = await verification.json()
    if (!challenge.success || challenge.action !== 'order_submit' || challenge.hostname !== new URL(env.SITE_URL).hostname) {
      throw new HttpError(400, 'Please complete the security check again.')
    }
    let payload
    try { payload = prepareOrder(input) } catch { throw new HttpError(400, 'Your cart or delivery details are invalid. Refresh your cart and try again.') }
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    const { data, error } = await supabase.rpc('submit_manual_order', { p_submission_id: input.submissionId, p_hash: hash, p_payload: payload })
    if (error?.message?.includes('submission_conflict')) throw new HttpError(409, 'This submission already contains a different order. Refresh before placing another order.')
    if (error) throw error
    try { await deliverOrderEmails(data.id) } catch { console.warn('Order email queued for retry.') }
    return json(200, { orderNumber: data.order_number, createdAt: data.created_at, paymentStatus: 'awaiting_payment', cart: payload.cart })
  } catch (error) { return errorResponse(error) }
}
