import { handler } from '../../netlify/functions/account-delete.js'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.js'

export default async function accountDelete(request: VercelRequest, response: VercelResponse) {
  return serveNetlifyHandler(request, response, handler)
}
