function environmentValue(value) {
  return String(value || '').trim()
}

export const siteServices = Object.freeze({
  accountDeletionEndpoint: environmentValue(import.meta.env.VITE_ACCOUNT_DELETION_ENDPOINT),
  checkoutEndpoint: environmentValue(import.meta.env.VITE_CHECKOUT_ENDPOINT),
  contactEndpoint: environmentValue(import.meta.env.VITE_CONTACT_ENDPOINT),
  newsletterEndpoint: environmentValue(import.meta.env.VITE_NEWSLETTER_ENDPOINT),
  orderTrackingEndpoint: environmentValue(import.meta.env.VITE_ORDER_TRACKING_ENDPOINT),
})

export async function postToSiteService(endpoint, payload, options = {}) {
  if (!endpoint) throw new Error('This service is not configured.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
      signal: controller.signal,
    })

    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json') ? await response.json() : {}
    if (!response.ok) {
      const error = new Error(data.message || `The service returned HTTP ${response.status}.`)
      error.status = response.status
      error.code = data.code
      error.details = data.details
      throw error
    }
    return data
  } finally {
    clearTimeout(timeout)
  }
}

export function safeServiceMessage(error, fallback) {
  if (error?.name === 'AbortError') return 'The request timed out. Please try again.'
  return error?.message && !/http \d{3}/i.test(error.message) ? error.message : fallback
}
