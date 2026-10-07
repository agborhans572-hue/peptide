import { handler } from '../../netlify/functions/process-account-deletions.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.js'

export default async function processAccountDeletions(request: VercelRequest, response: VercelResponse) {
  return serveNetlifyHandler(request, response, handler)
}
