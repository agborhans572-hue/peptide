import { handler } from '../netlify/functions/woocommerce-webhook.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from './_shared/netlify-adapter.js'

export const config = { api: { bodyParser: false } }

export default async function woocommerceWebhook(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
