import type { Handler } from '@netlify/functions'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { sendContactEmail } from './_shared/contact.ts'
import { contactEnv } from './_shared/env.ts'
import { clientFingerprint, errorResponse, HttpError, json, parseJson, requireSameOrigin } from './_shared/http.ts'

const contactMessage = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(10).max(5000),
  company: z.string().max(200).optional().default(''),
}).strict()

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })

    const env = contactEnv()
    requireSameOrigin(event, env.SITE_URL)
    const input = parseJson(event, contactMessage)
    if (input.company) return json(202, { message: 'Thanks—your message was sent successfully.' })

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const clientHash = createHash('sha256').update(clientFingerprint(event)).digest('hex')
    const { data: allowed, error } = await supabase.rpc('consume_rate_limit', {
      p_scope: 'contact',
      p_client_hash: clientHash,
      p_limit: 5,
      p_window_seconds: 900,
    })
    if (error) throw error
    if (!allowed) throw new HttpError(429, 'Too many messages. Please wait before trying again.')

    await sendContactEmail(input, {
      apiKey: env.RESEND_API_KEY,
      fromEmail: env.CONTACT_FROM_EMAIL,
    }, randomUUID())

    return json(202, { message: 'Thanks—your message was sent successfully.' })
  } catch (error) {
    return errorResponse(error)
  }
}
