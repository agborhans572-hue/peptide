import assert from 'node:assert/strict'
import test from 'node:test'
import { CONTACT_RECIPIENT, sendContactEmail } from '../netlify/functions/_shared/contact.ts'

test('contact delivery always targets the Pure Health Peptides Shop inbox', async () => {
  let requestBody: Record<string, unknown> | undefined
  await sendContactEmail({
    fullName: 'QA Researcher',
    email: 'researcher@example.com',
    message: 'Please send the requested batch documentation.',
  }, {
    apiKey: 're_test_key',
    fromEmail: CONTACT_RECIPIENT,
  }, 'contact-test-id', async (_input, init) => {
    requestBody = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ id: 'email-test-id' }), { status: 200 })
  })

  assert.deepEqual(requestBody?.to, [CONTACT_RECIPIENT])
  assert.equal(requestBody?.reply_to, 'researcher@example.com')
  assert.match(String(requestBody?.from), new RegExp(`<${CONTACT_RECIPIENT}>$`))
})

test('contact delivery exposes a safe retryable error when the provider is unavailable', async () => {
  await assert.rejects(
    sendContactEmail({
      fullName: 'QA Researcher',
      email: 'researcher@example.com',
      message: 'Please send the requested batch documentation.',
    }, {
      apiKey: 're_test_key',
      fromEmail: CONTACT_RECIPIENT,
    }, 'contact-test-id', async () => new Response('', { status: 503 })),
    (error: unknown) => {
      assert.equal((error as { statusCode?: number }).statusCode, 503)
      assert.equal((error as { retryable?: boolean }).retryable, true)
      assert.match((error as Error).message, new RegExp(CONTACT_RECIPIENT.replace('.', '\\.')))
      return true
    },
  )
})
