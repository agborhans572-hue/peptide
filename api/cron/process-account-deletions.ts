import { handler } from '../../netlify/functions/process-account-deletions.ts'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.ts'

export default async function processAccountDeletions(request: VercelRequest, response: VercelResponse) {
  return serveNetlifyHandler(request, response, handler)
}
