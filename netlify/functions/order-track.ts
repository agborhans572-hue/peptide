import type { Handler } from '@netlify/functions'
import { z } from 'zod'
import { clientFingerprint, errorResponse, HttpError, json, parseJson, requireSameOrigin } from './_shared/http.js'
import { fingerprint, services } from './_shared/services.js'

const trackingRequest = z.object({
  orderid: z.string().trim().min(8).max(40),
  order_email: z.string().trim().email().max(254),
})

const fulfillmentMessages: Record<string, string> = {
  blocked: 'Payment is still pending.',
  ready: 'Payment is confirmed and the order is awaiting processing.',
  processing: 'The order is being prepared for shipment.',
  fulfilled: 'The order has been fulfilled. Check your email for tracking details.',
  cancelled: 'The order is not scheduled for fulfillment. Contact support if you need help.',
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })
    const { env, supabase } = services()
    requireSameOrigin(event, env.SITE_URL)
    const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', {
      p_scope: 'order-track',
      p_client_hash: fingerprint(clientFingerprint(event)),
      p_limit: 15,
      p_window_seconds: 900,
    })
    if (rateError) throw rateError
    if (!allowed) throw new HttpError(429, 'Too many lookup attempts. Please try again later.')

    const input = parseJson(event, trackingRequest)
    const { data, error } = await supabase
      .from('orders')
      .select('fulfillment_status')
      .eq('order_number', input.orderid.toUpperCase())
      .eq('customer_email', input.order_email.toLowerCase())
      .maybeSingle()
    if (error) throw error
    if (!data) throw new HttpError(404, 'No matching order was found.')
    return json(200, { status: fulfillmentMessages[data.fulfillment_status] || 'Order status is available from support.' })
  } catch (error) {
    return errorResponse(error)
  }
}
