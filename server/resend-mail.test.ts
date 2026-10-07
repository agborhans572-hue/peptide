import assert from 'node:assert/strict'
import test from 'node:test'
import { sendResendEmail } from './resend-mail.ts'

const email = { from: 'orders@purehealthpeptidesshop.com', to: 'info@purehealthpeptidesshop.com', reply_to: 'customer@example.com', subject: 'Order request', text: 'Awaiting payment', html: '<p>Awaiting payment</p>' }
test('Resend requests use server authentication and a stable key on retry', async () => {
  const keys: string[] = []
  const request = (async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails')
    const headers = options?.headers as Record<string,string>
    assert.equal(headers.Authorization, 'Bearer re_test_server_only')
    keys.push(headers['Idempotency-Key'])
    assert.deepEqual(JSON.parse(options?.body as string), email)
    return Response.json({ id: 'accepted' })
  }) as typeof fetch
  await sendResendEmail('re_test_server_only', 'job-1', email, request)
  await sendResendEmail('re_test_server_only', 'job-1', email, request)
  assert.deepEqual(keys, ['order-email/job-1', 'order-email/job-1'])
})
test('provider failure or missing acknowledgment leaves delivery unsuccessful for retry', async () => {
  for (const status of [401, 429, 500]) {
    await assert.rejects(sendResendEmail('re_test', 'job', email, (async () => Response.json({ error: 'private details' }, { status })) as typeof fetch), new RegExp(String(status)))
  }
  await assert.rejects(sendResendEmail('re_test', 'job', email, (async () => Response.json({})) as typeof fetch), /acknowledge/)
})
