import { schedule } from '@netlify/functions'
import { deliverOrderEmails } from './_shared/manual-orders.ts'

export const handler = schedule('* * * * *', async () => {
  await deliverOrderEmails()
  return { statusCode: 200 }
})
