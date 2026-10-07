import { handler } from '../netlify/functions/client-error.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from './_shared/netlify-adapter.js'

export default async function clientError(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
