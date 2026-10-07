import type { Handler } from '@netlify/functions'
import { deliverOrderEmails, manualServices } from './_shared/manual-orders.js'
import { errorResponse, json } from './_shared/http.js'
export const handler: Handler = async event => {
  try {
    const { env } = manualServices()
    if (!env.CRON_SECRET || event.headers.authorization !== `Bearer ${env.CRON_SECRET}`) return json(401, { message: 'Unauthorized.' })
    const startedAt = Date.now()
    for (let batch = 0; batch < 20; batch++) {
      const processed = await deliverOrderEmails()
      if (processed < 2 || Date.now() - startedAt >= 10_000) break
    }
    return json(200, { ok: true })
  } catch (error) { return errorResponse(error) }
}
