import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'

export type VercelRequest = IncomingMessage & { query?: Record<string, string | string[] | undefined> }
export type VercelResponse = ServerResponse

type NetlifyResponse = {
  statusCode: number
  headers?: Record<string, string | number | boolean>
  body?: string
}

type NetlifyHandler = (event: {
  httpMethod: string
  headers: Record<string, string>
  body: string | null
  isBase64Encoded: boolean
  queryStringParameters: Record<string, string> | null
}) => Promise<NetlifyResponse>

function normalizedHeaders(headers: IncomingHttpHeaders) {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), Array.isArray(value) ? value.join(', ') : value || '']))
}

async function rawBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > 1024 * 1024) throw new RequestBodyTooLargeError()
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

class RequestBodyTooLargeError extends Error {}

function queryParameters(request: VercelRequest, headers: Record<string, string>) {
  const url = new URL(request.url || '/', `https://${headers.host || 'localhost'}`)
  const parameters = Object.fromEntries(url.searchParams.entries())
  for (const [key, value] of Object.entries(request.query || {})) {
    if (typeof value === 'string') parameters[key] = value
    if (Array.isArray(value) && value[0]) parameters[key] = value[0]
  }
  return Object.keys(parameters).length ? parameters : null
}

export async function serveNetlifyHandler(request: VercelRequest, response: VercelResponse, handler: NetlifyHandler) {
  const headers = normalizedHeaders(request.headers)
  let body: string
  try {
    body = await rawBody(request)
  } catch (error) {
    if (!(error instanceof RequestBodyTooLargeError)) throw error
    response.statusCode = 413
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.end(JSON.stringify({ message: 'Request body is too large.' }))
    return
  }
  const result = await handler({
    httpMethod: request.method || 'GET',
    headers,
    body,
    isBase64Encoded: false,
    queryStringParameters: queryParameters(request, headers),
  })

  for (const [name, value] of Object.entries(result.headers || {})) response.setHeader(name, value)
  response.statusCode = result.statusCode
  response.end(result.body || '')
}
