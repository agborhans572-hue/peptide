import { handler } from '../netlify/functions/client-error.ts'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from './_shared/netlify-adapter.ts'

export default async function clientError(request: VercelRequest, response: VercelResponse) {
  await serveNetlifyHandler(request, response, handler)
}
