import { HttpError } from './http.js'

export const CONTACT_RECIPIENT = 'info@purehealthpeptidesshop.com'

type ContactMessage = {
  fullName: string
  email: string
  message: string
}

type ContactDeliveryConfig = {
  apiKey: string
  fromEmail: string
}

export async function sendContactEmail(
  contact: ContactMessage,
  config: ContactDeliveryConfig,
  idempotencyKey: string,
  fetchEmail: typeof fetch = fetch,
) {
  let response: Response
  try {
    response = await fetchEmail('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'User-Agent': 'pure-health-peptides-contact/1.0',
      },
      body: JSON.stringify({
        from: `Pure Health Peptides Website <${config.fromEmail}>`,
        to: [CONTACT_RECIPIENT],
        reply_to: contact.email,
        subject: 'New website enquiry',
        text: [
          'A new enquiry was submitted through purehealthpeptidesshop.com.',
          '',
          `Name: ${contact.fullName}`,
          `Reply email: ${contact.email}`,
          '',
          'Message:',
          contact.message,
        ].join('\n'),
        tags: [{ name: 'source', value: 'website-contact' }],
      }),
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new HttpError(
      503,
      `Your message could not be sent. Please try again or email ${CONTACT_RECIPIENT}.`,
      'contact_delivery_unavailable',
      undefined,
      true,
    )
  }

  if (response.ok) return

  const retryable = response.status === 429 || response.status >= 500
  throw new HttpError(
    retryable ? 503 : 502,
    `Your message could not be sent. Please try again or email ${CONTACT_RECIPIENT}.`,
    'contact_delivery_failed',
    undefined,
    retryable,
  )
}
