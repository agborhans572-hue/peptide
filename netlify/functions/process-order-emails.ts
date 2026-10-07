import type { Handler } from '@netlify/functions'
import { deliverOrderEmails, manualServices } from './_shared/manual-orders.ts'
import { errorResponse, json } from './_shared/http.ts'
export const handler: Handler = async event => {
  try {
    const { env } = manualServices()
    if (!env.CRON_SECRET || event.headers.authorization !== `Bearer ${env.CRON_SECRET}`) return json(401, { message: 'Unauthorized.' })
    await deliverOrderEmails()
    return json(200, { ok: true })
  } catch (error) { return errorResponse(error) }
}
