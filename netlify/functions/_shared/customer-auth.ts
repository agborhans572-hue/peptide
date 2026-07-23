import type { HandlerEvent } from '@netlify/functions'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { HttpError } from './http.ts'

export type ActiveCustomer = {
  profile: {
    status: 'active'
    user_id: string
  }
  token: string
  user: User
}

function bearerToken(event: HandlerEvent) {
  const authorization = event.headers.authorization || ''
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i)
  return match?.[1] || ''
}

export async function optionalActiveCustomer(
  event: HandlerEvent,
  supabase: SupabaseClient,
): Promise<ActiveCustomer | null> {
  const token = bearerToken(event)
  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)
  const user = data.user
  if (error || !user) throw new HttpError(401, 'Your session is invalid or expired.', 'invalid_session')
  if (!user.email || !user.email_confirmed_at) {
    throw new HttpError(403, 'Verify your email before using this account.', 'email_unverified')
  }

  const { data: profile, error: profileError } = await supabase
    .from('customer_profiles')
    .select('user_id,status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profileError) throw profileError
  if (!profile || profile.status !== 'active') {
    throw new HttpError(403, 'This account is unavailable.', 'account_unavailable')
  }

  return { profile, token, user } as ActiveCustomer
}

export async function requireActiveCustomer(event: HandlerEvent, supabase: SupabaseClient) {
  const customer = await optionalActiveCustomer(event, supabase)
  if (!customer) throw new HttpError(401, 'Sign in before using this account function.', 'authentication_required')
  return customer
}

export function tokenIssuedAt(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as {
      iat?: unknown
    }
    const issuedAt = Number(payload.iat)
    return Number.isFinite(issuedAt) && issuedAt > 0 ? issuedAt * 1000 : 0
  } catch {
    return 0
  }
}

export function requireRecentAuthentication(token: string, maximumAgeSeconds = 15 * 60) {
  const issuedAt = tokenIssuedAt(token)
  if (!issuedAt || Date.now() < issuedAt || Date.now() - issuedAt > maximumAgeSeconds * 1000) {
    throw new HttpError(403, 'Sign in again before completing this sensitive action.', 'recent_authentication_required')
  }
}
