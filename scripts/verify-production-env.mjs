const required = [
  'SITE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'WOOCOMMERCE_URL',
  'WC_CONSUMER_KEY',
  'WC_CONSUMER_SECRET',
  'COMMERCE_RESERVATIONS_ENABLED',
  'WOO_BRIDGE_SECRET_CURRENT',
  'WOO_WEBHOOK_SECRET',
  'VITE_SITE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_TURNSTILE_SITE_KEY',
  'VITE_GOOGLE_AUTH_ENABLED',
  'VITE_ACCOUNT_DELETION_ENDPOINT',
  'VITE_CHECKOUT_ENDPOINT',
]

const errors = []
if (process.env.APP_ENV !== 'production') errors.push('APP_ENV must be production')
for (const name of required) {
  if (!process.env[name]?.trim()) errors.push(`${name} is required`)
}
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) errors.push('STRIPE_SECRET_KEY must be a live key')
if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) errors.push('STRIPE_WEBHOOK_SECRET must be a webhook signing secret')
if (!process.env.SITE_URL?.startsWith('https://')) errors.push('SITE_URL must use HTTPS')
if (process.env.SITE_URL !== 'https://purehealthpeptidesshop.com') {
  errors.push('SITE_URL must be the canonical production origin')
}
if (process.env.VITE_SITE_URL !== process.env.SITE_URL) {
  errors.push('VITE_SITE_URL must match SITE_URL')
}
if (process.env.VITE_SUPABASE_URL !== process.env.SUPABASE_URL) {
  errors.push('VITE_SUPABASE_URL must match SUPABASE_URL')
}
if (process.env.VITE_ACCOUNT_DELETION_ENDPOINT !== '/api/account/delete-request') {
  errors.push('VITE_ACCOUNT_DELETION_ENDPOINT must use the same-origin production route')
}
if ((process.env.CRON_SECRET || '').length < 32) errors.push('CRON_SECRET must contain at least 32 characters')
if ((process.env.WOO_BRIDGE_SECRET_CURRENT || '').length < 32) errors.push('WOO_BRIDGE_SECRET_CURRENT must contain at least 32 characters')
if ((process.env.WOO_WEBHOOK_SECRET || '').length < 32) errors.push('WOO_WEBHOOK_SECRET must contain at least 32 characters')
if (process.env.COMMERCE_RESERVATIONS_ENABLED !== 'true') errors.push('COMMERCE_RESERVATIONS_ENABLED must be true in production')
if (!['true', 'false'].includes(process.env.VITE_GOOGLE_AUTH_ENABLED || 'false')) {
  errors.push('VITE_GOOGLE_AUTH_ENABLED must be true or false')
}

for (const [name, value] of Object.entries(process.env)) {
  if (!name.startsWith('VITE_')) continue
  if (/secret|service.role|private|webhook|password|token/i.test(name)) errors.push(`${name} looks like a secret`)
  if (/^(sk_(test|live)_|whsec_|eyJ[A-Za-z0-9_-]+\.)/.test(value || '')) errors.push(`${name} contains secret-looking data`)
}

if (errors.length) {
  console.error(`Production environment validation failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log('Production environment validation passed.')
