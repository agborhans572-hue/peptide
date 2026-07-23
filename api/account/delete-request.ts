import { handler } from '../../netlify/functions/account-delete.ts'
import { serveNetlifyHandler, type VercelRequest, type VercelResponse } from '../_shared/netlify-adapter.ts'

export default async function accountDelete(request: VercelRequest, response: VercelResponse) {
  return serveNetlifyHandler(request, response, handler)
}
