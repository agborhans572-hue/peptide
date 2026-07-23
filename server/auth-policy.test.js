import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'
import {
  AUTH_ABSOLUTE_TIMEOUT_MS,
  AUTH_IDLE_TIMEOUT_MS,
  MINIMUM_PASSWORD_LENGTH,
  RECENT_AUTH_WINDOW_MS,
  authLinkErrorMessage,
  captchaOptions,
  isRecentAuthentication,
  passwordPolicyError,
  safeAuthError,
  sessionExpiryReason,
  sessionIssuedAt,
} from '../src/authPolicy.js'
import { canonicalAuthRedirect, normalizeSiteOrigin } from '../src/supabaseBrowser.js'
import {
  requireRecentAuthentication,
  tokenIssuedAt,
} from '../netlify/functions/_shared/customer-auth.ts'
import { HttpError, requireSameOrigin } from '../netlify/functions/_shared/http.ts'

function token(issuedAtSeconds) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ iat: issuedAtSeconds, sub: 'customer' })}.signature`
}

test('enforces the twelve-character password policy', () => {
  assert.equal(MINIMUM_PASSWORD_LENGTH, 12)
  assert.match(passwordPolicyError('short'), /at least 12/)
  assert.equal(passwordPolicyError('twelve-chars!'), '')
})

test('requires and forwards a trimmed CAPTCHA token', () => {
  assert.deepEqual(captchaOptions(' verified-token '), { captchaToken: 'verified-token' })
  assert.throws(() => captchaOptions(''), /security check/)
})

test('uses the current JWT issue time for recent authentication', () => {
  const now = Date.now()
  const accessToken = token(Math.floor((now - 1_000) / 1000))
  assert.ok(Math.abs(sessionIssuedAt(accessToken) - (now - 1_000)) < 1_000)
  assert.equal(isRecentAuthentication(accessToken, now), true)
  assert.equal(
    isRecentAuthentication(token(Math.floor((now - RECENT_AUTH_WINDOW_MS - 2_000) / 1000)), now),
    false,
  )
  assert.equal(isRecentAuthentication('not-a-token', now), false)
})

test('server recent-auth enforcement uses the verified token issue time', () => {
  const recent = token(Math.floor(Date.now() / 1000))
  assert.ok(tokenIssuedAt(recent) > 0)
  assert.doesNotThrow(() => requireRecentAuthentication(recent))
  assert.throws(
    () => requireRecentAuthentication(token(Math.floor(Date.now() / 1000) - (16 * 60))),
    (error) => error instanceof HttpError && error.code === 'recent_authentication_required',
  )
})

test('distinguishes idle and absolute session expiration', () => {
  const now = Date.now()
  assert.equal(sessionExpiryReason({
    startedAt: now - 1_000,
    lastActivityAt: now - AUTH_IDLE_TIMEOUT_MS,
  }, now), 'idle')
  assert.equal(sessionExpiryReason({
    startedAt: now - AUTH_ABSOLUTE_TIMEOUT_MS,
    lastActivityAt: now,
  }, now), 'absolute')
  assert.equal(sessionExpiryReason({ startedAt: now, lastActivityAt: now }, now), '')
})

test('returns clear, safe authentication and link errors', () => {
  assert.match(authLinkErrorMessage('otp_expired'), /expired/)
  assert.match(authLinkErrorMessage('missing_code'), /missing/)
  assert.match(authLinkErrorMessage('access_denied'), /invalid/)
  assert.equal(safeAuthError({ status: 429 }), 'Too many attempts. Please wait a few minutes before trying again.')
  assert.equal(safeAuthError({ message: 'Invalid login credentials' }), 'The email or password is incorrect.')
  assert.match(safeAuthError({ message: 'captcha verification failed' }), /security check/)
})

test('builds canonical production auth redirects', () => {
  assert.equal(normalizeSiteOrigin('https://purehealthpeptides.com/path/'), 'https://purehealthpeptides.com')
  assert.equal(
    canonicalAuthRedirect('https://purehealthpeptides.com', '/auth/callback/'),
    'https://purehealthpeptides.com/auth/callback/',
  )
  assert.equal(canonicalAuthRedirect('not a url', '/auth/callback/'), '')
})

test('protected functions reject missing or foreign origins', () => {
  assert.doesNotThrow(() => requireSameOrigin(
    { headers: { origin: 'https://purehealthpeptides.com' } },
    'https://purehealthpeptides.com',
  ))
  assert.throws(
    () => requireSameOrigin(
      { headers: { origin: 'https://attacker.example' } },
      'https://purehealthpeptides.com',
    ),
    (error) => error instanceof HttpError && error.statusCode === 403,
  )
  assert.throws(
    () => requireSameOrigin({ headers: {} }, 'https://purehealthpeptides.com'),
    (error) => error instanceof HttpError && error.statusCode === 403,
  )
})
