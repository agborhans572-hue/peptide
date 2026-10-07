export type OutgoingEmail = { from: string; to: string; reply_to: string; subject: string; text: string; html: string }

export async function sendResendEmail(apiKey: string, jobId: string, email: OutgoingEmail, request: typeof fetch = fetch) {
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `order-email/${jobId}` },
    body: JSON.stringify(email), signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`Email provider returned ${response.status}.`)
  const result = await response.json() as { id?: string }
  if (!result.id) throw new Error('Email provider did not acknowledge the email.')
  return result.id
}
