export const AUTH_IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000
export const AUTH_ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000
export const RECENT_AUTH_WINDOW_MS = 15 * 60 * 1000
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000
export const MINIMUM_PASSWORD_LENGTH = 12

function decodeJwtPayload(accessToken) {
  try {
    const payload = String(accessToken || '').split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(globalThis.atob(padded))
  } catch {
    return null
  }
}

export function sessionIssuedAt(accessToken) {
  const issuedAt = Number(decodeJwtPayload(accessToken)?.iat)
  return Number.isFinite(issuedAt) && issuedAt > 0 ? issuedAt * 1000 : 0
}

export function isRecentAuthentication(accessToken, now = Date.now()) {
  const timestamp = sessionIssuedAt(accessToken)
  return timestamp > 0 && now >= timestamp && now - timestamp <= RECENT_AUTH_WINDOW_MS
}

export function passwordPolicyError(password) {
  return String(password || '').length >= MINIMUM_PASSWORD_LENGTH
    ? ''
    : `Use at least ${MINIMUM_PASSWORD_LENGTH} characters for your password.`
}

export function requireCaptchaToken(token) {
  const value = String(token || '').trim()
  if (!value) throw new Error('Complete the security check before continuing.')
  return value
}

export function captchaOptions(token) {
  return { captchaToken: requireCaptchaToken(token) }
}

export function sessionExpiryReason(lifecycle, now = Date.now()) {
  if (!lifecycle?.startedAt || !lifecycle?.lastActivityAt) return ''
  if (now - lifecycle.startedAt >= AUTH_ABSOLUTE_TIMEOUT_MS) return 'absolute'
  if (now - lifecycle.lastActivityAt >= AUTH_IDLE_TIMEOUT_MS) return 'idle'
  return ''
}

export function authLinkErrorMessage(errorCode, description = '') {
  const value = `${errorCode || ''} ${description || ''}`.toLowerCase()
  if (value.includes('expired') || value.includes('otp_expired')) {
    return 'This link has expired. Request a new verification or password-reset link.'
  }
  if (value.includes('recovery') || value.includes('missing')) {
    return 'This password-reset session is missing or no longer valid. Request a new link.'
  }
  return 'This sign-in link is invalid or has already been used. Request a new link.'
}

export function safeAuthError(error, fallback = 'We could not complete that request. Please try again.') {
  const status = Number(error?.status)
  const message = String(error?.message || '').toLowerCase()
  if (status === 429 || message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes before trying again.'
  }
  if (message.includes('email not confirmed')) {
    return 'Verify your email before signing in. You can request a new verification link below.'
  }
  if (message.includes('invalid login credentials')) {
    return 'The email or password is incorrect.'
  }
  if (message.includes('password should be')) {
    return `Use a stronger password with at least ${MINIMUM_PASSWORD_LENGTH} characters.`
  }
  if (message.includes('captcha')) {
    return 'The security check expired or could not be verified. Complete it again.'
  }
  if (message.includes('session') && message.includes('expired')) {
    return 'Your session expired. Sign in again.'
  }
  return fallback
}
