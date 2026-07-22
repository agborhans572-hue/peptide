import { handler } from '../netlify/functions/checkout.ts'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from './_shared/netlify-adapter.ts'

export default async function checkout(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
