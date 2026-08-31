import { handler } from '../netlify/functions/checkout.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from './_shared/netlify-adapter.js'

export default async function checkout(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
