import { handler } from '../../netlify/functions/order-track.ts'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.ts'

export default async function trackOrder(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
