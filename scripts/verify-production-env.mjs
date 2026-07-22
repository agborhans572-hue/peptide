const required = [
  'SITE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'MONITORING_WEBHOOK_URL',
  'WOOCOMMERCE_URL',
  'WC_CONSUMER_KEY',
  'WC_CONSUMER_SECRET',
]

const errors = []
if (process.env.APP_ENV !== 'production') errors.push('APP_ENV must be production')
for (const name of required) {
  if (!process.env[name]?.trim()) errors.push(`${name} is required`)
}
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) errors.push('STRIPE_SECRET_KEY must be a live key')
if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) errors.push('STRIPE_WEBHOOK_SECRET must be a webhook signing secret')
if (!process.env.SITE_URL?.startsWith('https://')) errors.push('SITE_URL must use HTTPS')

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
