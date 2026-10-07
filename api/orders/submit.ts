import { handler } from '../../netlify/functions/order-submit.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.js'
export default async function submit(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
