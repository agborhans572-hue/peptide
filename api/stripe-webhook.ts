import { handler } from '../netlify/functions/stripe-webhook.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from './_shared/netlify-adapter.js'

export const config = { api: { bodyParser: false } }

export default async function stripeWebhook(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
