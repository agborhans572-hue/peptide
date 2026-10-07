import { handler } from '../netlify/functions/contact.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from './_shared/netlify-adapter.js'

export default async function contact(request: VercelRequest, response: VercelResponse) {
  return serveNetlifyHandler(request, response, handler)
}
