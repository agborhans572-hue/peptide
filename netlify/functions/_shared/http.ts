import type { HandlerEvent, HandlerResponse } from '@netlify/functions'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

export function json(statusCode: number, body: unknown, headers: Record<string, string> = {}): HandlerResponse {
  return { statusCode, headers: { ...securityHeaders, ...headers }, body: JSON.stringify(body) }
}

export function parseJson<T>(event: HandlerEvent, schema: z.ZodType<T>): T {
  if (!event.body || !event.headers['content-type']?.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'A JSON request body is required.')
  }
  if (Buffer.byteLength(event.body, 'utf8') > 64 * 1024) {
    throw new HttpError(413, 'The request body is too large.')
  }
  try {
    return schema.parse(JSON.parse(event.body))
  } catch (error) {
    if (error instanceof z.ZodError) throw new HttpError(400, 'The request data is invalid.')
    throw error
  }
}

export function requireSameOrigin(event: HandlerEvent, siteUrl: string) {
  const origin = event.headers.origin
  if (!origin || new URL(origin).origin !== new URL(siteUrl).origin) {
    throw new HttpError(403, 'The request origin is not allowed.')
  }
}

export function clientFingerprint(event: HandlerEvent) {
  const raw = event.headers['x-nf-client-connection-ip']
    || event.headers['x-forwarded-for']?.split(',')[0]
    || 'unknown'
  return raw.trim().slice(0, 80)
}

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown,
    public retryable = false,
  ) {
    super(message)
  }
}

export function errorResponse(error: unknown) {
  const requestId = randomUUID()
  if (error instanceof HttpError) return json(error.statusCode, {
    message: error.message,
    code: error.code,
    details: error.details,
    retryable: error.retryable,
    requestId,
  }, { ...(error.retryable ? { 'Retry-After': '5' } : {}), 'X-Request-Id': requestId })
  if (error instanceof z.ZodError) return json(500, { message: 'Server configuration is invalid.', requestId }, { 'X-Request-Id': requestId })
  return json(500, { message: 'The service is temporarily unavailable.', requestId }, { 'X-Request-Id': requestId })
}
