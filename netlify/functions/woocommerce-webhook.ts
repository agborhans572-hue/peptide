import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Handler } from '@netlify/functions'
import { wooWebhookSecret } from './_shared/env.js'
import { errorResponse, json } from './_shared/http.js'
import { services } from './_shared/services.js'

function signatureValid(body: string, supplied: string, secret: string) {
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('base64'))
  const actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })
    if (!event.body || Buffer.byteLength(event.body, 'utf8') > 1024 * 1024) {
      return json(event.body ? 413 : 400, { message: event.body ? 'Webhook body is too large.' : 'Webhook body is required.' })
    }
    const supplied = event.headers['x-wc-webhook-signature'] || ''
    if (!signatureValid(event.body, supplied, wooWebhookSecret())) return json(401, { message: 'Invalid WooCommerce signature.' })
    const topic = event.headers['x-wc-webhook-topic'] || ''
    if (!topic.startsWith('order.')) return json(200, { received: true, ignored: true })
    const payload = JSON.parse(event.body) as { id?: unknown, status?: unknown, total?: unknown }
    const wooOrderId = Number(payload.id)
    const totalCents = Math.round(Number(payload.total) * 100)
    const status = String(payload.status || '')
    if (!Number.isInteger(wooOrderId) || wooOrderId < 1 || !Number.isInteger(totalCents) || totalCents < 0 || !status) {
      return json(400, { message: 'Invalid WooCommerce order payload.' })
    }
    const { supabase } = services()
    const { data, error } = await supabase.rpc('apply_woo_order_projection', {
      p_total_cents: totalCents,
      p_woo_order_id: wooOrderId,
      p_woo_status: status,
    })
    if (error) throw error
    return json(200, { received: true, processed: data })
  } catch (error) {
    console.error(JSON.stringify({ event: 'woocommerce.webhook_failed', message: error instanceof Error ? error.message : String(error) }))
    return errorResponse(error)
  }
}
