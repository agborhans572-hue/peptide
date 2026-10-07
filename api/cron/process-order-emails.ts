import { handler } from '../../netlify/functions/process-order-emails.ts'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.ts'
export default async function processEmails(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
