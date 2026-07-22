import { handler } from '../netlify/functions/stripe-webhook.ts'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from './_shared/netlify-adapter.ts'

export const config = { api: { bodyParser: false } }

export default async function stripeWebhook(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
