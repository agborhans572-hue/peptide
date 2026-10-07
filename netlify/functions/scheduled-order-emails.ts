import { schedule } from '@netlify/functions'
import { deliverOrderEmails } from './_shared/manual-orders.js'

export const handler = schedule('* * * * *', async () => {
  await deliverOrderEmails()
  return { statusCode: 200 }
})
