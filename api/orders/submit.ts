import { handler } from '../../netlify/functions/order-submit.ts'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.ts'
export default async function submit(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
