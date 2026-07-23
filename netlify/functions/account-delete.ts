import type { Handler } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { requireActiveCustomer, requireRecentAuthentication } from './_shared/customer-auth.ts'
import { clientFingerprint, errorResponse, HttpError, json, parseJson, requireSameOrigin } from './_shared/http.ts'
import { fingerprint, services } from './_shared/services.ts'

const requestSchema = z.object({
  confirmation: z.literal('DELETE'),
})

type DeletionRequest = {
  eligible_at: string
  id: string
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' })
    const { env, supabase } = services()
    requireSameOrigin(event, env.SITE_URL)
    parseJson(event, requestSchema)

    const customer = await requireActiveCustomer(event, supabase)
    requireRecentAuthentication(customer.token)

    const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', {
      p_scope: 'account_deletion',
      p_client_hash: fingerprint(`${customer.user.id}:${clientFingerprint(event)}`),
      p_limit: 3,
      p_window_seconds: 3600,
    })
    if (rateError) throw rateError
    if (!allowed) throw new HttpError(429, 'Too many deletion attempts. Try again later.')

    const emailHash = createHash('sha256')
      .update(customer.user.email!.trim().toLowerCase())
      .digest('hex')
    const { data, error } = await supabase.rpc('queue_account_deletion', {
      p_user_id: customer.user.id,
      p_email_hash: emailHash,
    }).single()
    const request = data as DeletionRequest | null
    if (error || !request) throw error || new Error('Deletion request was not created.')

    await supabase.auth.admin.signOut(customer.token, 'global')

    return json(202, {
      message: 'Account deletion is scheduled and protected access is disabled.',
      eligibleAt: request.eligible_at,
      requestId: request.id,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
