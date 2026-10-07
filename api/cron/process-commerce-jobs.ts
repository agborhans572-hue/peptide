import { handler } from '../../netlify/functions/process-commerce-jobs.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.js'

export default async function processCommerceJobs(request: VercelRequest, response: VercelResponse) {
  return serveNetlifyHandler(request, response, handler)
}
