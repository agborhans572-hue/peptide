import { z } from 'zod'

const baseFields = {
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  SITE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(30),
  STRIPE_SECRET_KEY: z.string().regex(/^sk_(test|live)_/),
  WOOCOMMERCE_URL: z.string().url(),
  WC_CONSUMER_KEY: z.string().min(10),
  WC_CONSUMER_SECRET: z.string().min(10),
  COMMERCE_RESERVATIONS_ENABLED: z.enum(['true', 'false']).default('false'),
  WOO_BRIDGE_SECRET_CURRENT: z.string().min(32).optional(),
  WOO_BRIDGE_SECRET_PREVIOUS: z.string().min(32).optional(),
  WOO_WEBHOOK_SECRET: z.string().min(32).optional(),
  MONITORING_WEBHOOK_URL: z.string().url().optional(),
}

const baseSchema = z.object(baseFields)

export function serverEnv() {
  const env = baseSchema.parse(process.env)
  const isLiveKey = env.STRIPE_SECRET_KEY.startsWith('sk_live_')
  if (env.APP_ENV === 'production' && !isLiveKey) {
    throw new Error('Production requires a Stripe live secret key.')
  }
  if (env.APP_ENV !== 'production' && isLiveKey) {
    throw new Error('Stripe live keys are forbidden outside production.')
  }
  if (env.COMMERCE_RESERVATIONS_ENABLED === 'true' && !env.WOO_BRIDGE_SECRET_CURRENT) {
    throw new Error('The WooCommerce bridge secret is required when reservations are enabled.')
  }
  return env
}

export function webhookEnv() {
  const env = z.object({
    ...baseFields,
    STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_/),
  }).parse(process.env)
  if (env.COMMERCE_RESERVATIONS_ENABLED === 'true' && !env.WOO_BRIDGE_SECRET_CURRENT) {
    throw new Error('The WooCommerce bridge secret is required when reservations are enabled.')
  }
  return env
}

export function cronSecret() {
  return z.string().min(32).parse(process.env.CRON_SECRET)
}

export function wooWebhookSecret() {
  return z.string().min(32).parse(process.env.WOO_WEBHOOK_SECRET)
}

export function contactEnv() {
  return z.object({
    SITE_URL: z.string().url(),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(30),
    RESEND_API_KEY: z.string().regex(/^re_/),
    CONTACT_FROM_EMAIL: z.string().email(),
  }).parse(process.env)
}
