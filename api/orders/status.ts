import { handler } from '../../netlify/functions/order-status.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.js'

export default async function orderStatus(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
