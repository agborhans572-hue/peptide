import { handler } from '../netlify/functions/contact.ts'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from './_shared/netlify-adapter.ts'

export default async function contact(request: VercelRequest, response: VercelResponse) {
  return serveNetlifyHandler(request, response, handler)
}
