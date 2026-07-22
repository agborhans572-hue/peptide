import { handler } from '../../netlify/functions/order-status.ts'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.ts'

export default async function orderStatus(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
