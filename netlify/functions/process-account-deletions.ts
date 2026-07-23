import type { Handler } from '@netlify/functions'
import { cronSecret } from './_shared/env.ts'
import { errorResponse, json } from './_shared/http.ts'
import { services } from './_shared/services.ts'

function authorized(header: string | undefined, secret: string) {
  return header === `Bearer ${secret}`
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
      return json(405, { message: 'Method not allowed.' })
    }
    const secret = cronSecret()
    if (!authorized(event.headers.authorization, secret)) {
      return json(401, { message: 'Cron authorization failed.' })
    }

    const { supabase } = services()
    const { data: requests, error } = await supabase
      .from('account_deletion_requests')
      .select('id,user_id')
      .in('status', ['pending', 'deferred'])
      .eq('legal_hold', false)
      .lte('eligible_at', new Date().toISOString())
      .order('eligible_at', { ascending: true })
      .limit(5)
    if (error) throw error

    const results = { completed: 0, deferred: 0, skipped: 0 }
    for (const request of requests || []) {
      const { data: userId, error: prepareError } = await supabase.rpc('prepare_account_deletion', {
        p_request_id: request.id,
      })
      if (prepareError) throw prepareError
      if (!userId) {
        results.skipped += 1
        continue
      }

      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId, false)
      if (deleteError) {
        await supabase.rpc('defer_account_deletion', {
          p_request_id: request.id,
          p_reason: 'Authentication record deletion will be retried.',
        })
        results.deferred += 1
        continue
      }
      const { error: completeError } = await supabase.rpc('complete_account_deletion', {
        p_request_id: request.id,
      })
      if (completeError) throw completeError
      results.completed += 1
    }

    return json(200, { processed: (requests || []).length, ...results })
  } catch (error) {
    return errorResponse(error)
  }
}
