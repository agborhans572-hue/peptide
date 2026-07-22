import type { Handler } from '@netlify/functions'
import { z } from 'zod'
import { clientFingerprint, errorResponse, HttpError, json, parseJson, requireSameOrigin } from './_shared/http.ts'
import { reportOperationalError } from './_shared/monitor.ts'
import { fingerprint, services } from './_shared/services.ts'

const clientError = z.object({
  message: z.string().min(1).max(500),
  componentStack: z.string().max(3000).optional(),
  path: z.string().max(500),
})

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })
    const { env, supabase } = services()
    requireSameOrigin(event, env.SITE_URL)
    const { data: allowed, error } = await supabase.rpc('consume_rate_limit', {
      p_scope: 'client-error',
      p_client_hash: fingerprint(clientFingerprint(event)),
      p_limit: 10,
      p_window_seconds: 900,
    })
    if (error) throw error
    if (!allowed) throw new HttpError(429, 'Too many reports.')
    const report = parseJson(event, clientError)
    await reportOperationalError(env.MONITORING_WEBHOOK_URL, 'client.render_failed', report.message, {
      path: report.path,
      componentStack: report.componentStack,
    })
    return json(202, { received: true })
  } catch (error) {
    return errorResponse(error)
  }
}
