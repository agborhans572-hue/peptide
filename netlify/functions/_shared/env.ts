import { z } from 'zod'

const baseSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  SITE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(30),
  STRIPE_SECRET_KEY: z.string().regex(/^sk_(test|live)_/),
  WOOCOMMERCE_URL: z.string().url(),
  WC_CONSUMER_KEY: z.string().min(10),
  WC_CONSUMER_SECRET: z.string().min(10),
  MONITORING_WEBHOOK_URL: z.string().url().optional(),
})

export function serverEnv() {
  const env = baseSchema.parse(process.env)
  const isLiveKey = env.STRIPE_SECRET_KEY.startsWith('sk_live_')
  if (env.APP_ENV === 'production' && !isLiveKey) {
    throw new Error('Production requires a Stripe live secret key.')
  }
  if (env.APP_ENV !== 'production' && isLiveKey) {
    throw new Error('Stripe live keys are forbidden outside production.')
  }
  return env
}

export function webhookEnv() {
  return baseSchema.extend({
    STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_/),
  }).parse(process.env)
}

export function cronSecret() {
  return z.string().min(32).parse(process.env.CRON_SECRET)
}
