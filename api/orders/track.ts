import { handler } from '../../netlify/functions/order-track.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.js'

export default async function trackOrder(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
