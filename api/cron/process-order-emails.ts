import { handler } from '../../netlify/functions/process-order-emails.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.js'
export default async function processEmails(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
