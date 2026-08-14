import type { Handler } from '@netlify/functions'
import { errorResponse, json, requireSameOrigin } from './_shared/http.ts'
import { services } from './_shared/services.ts'

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { message: 'Method not allowed.' })
    const { env, supabase } = services()
    requireSameOrigin(event, env.SITE_URL)
    const sessionId = event.queryStringParameters?.session_id
    if (!sessionId?.startsWith('cs_')) return json(400, { message: 'Invalid checkout session.' })

    const { data, error } = await supabase
      .from('orders')
      .select('order_number,payment_status,fulfillment_status,total_cents,currency')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()
    if (error || !data) return json(404, { message: 'Order not found.' })
    if (data.payment_status === 'pending') {
      return json(202, { message: 'Payment verification is still processing.', pending: true }, { 'Retry-After': '2' })
    }
    if (data.payment_status !== 'paid' && data.payment_status !== 'partially_refunded' && data.payment_status !== 'refunded') {
      return json(409, { message: 'This checkout did not complete successfully.' })
    }

    return json(200, {
      orderNumber: data.order_number,
      paymentStatus: data.payment_status,
      fulfillmentStatus: data.fulfillment_status,
      totalCents: data.total_cents,
      currency: data.currency,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
