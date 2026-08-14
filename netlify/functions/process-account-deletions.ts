import type { Handler } from '@netlify/functions'
import { randomUUID } from 'node:crypto'
import { cronSecret } from './_shared/env.ts'
import { errorResponse, json } from './_shared/http.ts'
import { services } from './_shared/services.ts'

function authorized(header: string | undefined, secret: string) {
  return header === `Bearer ${secret}`
}

async function inBatches<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      await worker(item)
    }
  }))
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
    const workerId = `account-delete-${randomUUID()}`
    const { data: requests, error } = await (supabase as any).rpc('claim_account_deletions', {
      p_worker_id: workerId,
      p_limit: 100,
      p_lease_seconds: 600,
    })
    if (error) throw error

    const results = { completed: 0, deferred: 0, skipped: 0 }
    await inBatches((requests || []) as Array<{ id: string }>, 5, async (request) => {
      const { data: userId, error: prepareError } = await (supabase as any).rpc('prepare_leased_account_deletion', {
        p_request_id: request.id,
        p_worker_id: workerId,
      })
      if (prepareError) throw prepareError
      if (!userId) {
        results.skipped += 1
        return
      }

      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId, false)
      if (deleteError) {
        await supabase.rpc('defer_account_deletion', {
          p_request_id: request.id,
          p_reason: 'Authentication record deletion will be retried.',
        })
        results.deferred += 1
        return
      }
      const { error: completeError } = await supabase.rpc('complete_account_deletion', {
        p_request_id: request.id,
      })
      if (completeError) throw completeError
      results.completed += 1
    })

    return json(200, { processed: (requests || []).length, ...results })
  } catch (error) {
    return errorResponse(error)
  }
}
