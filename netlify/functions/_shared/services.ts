import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { serverEnv } from './env.ts'

export function services() {
  const env = serverEnv()
  return {
    env,
    stripe: new Stripe(env.STRIPE_SECRET_KEY),
    supabase: createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  }
}

export function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex')
}
