import { readFile } from 'node:fs/promises'

const required = [
  'RESEND_API_KEY', 'TURNSTILE_SECRET_KEY',
  'SITE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
  'VITE_SITE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_TURNSTILE_SITE_KEY',
  'VITE_CHATWOOT_WEBSITE_TOKEN',
  'VITE_CHATWOOT_BASE_URL',
  'VITE_GOOGLE_AUTH_ENABLED',
  'VITE_ACCOUNT_DELETION_ENDPOINT',
]

const publicClientTokenVariables = new Set(['VITE_CHATWOOT_WEBSITE_TOKEN'])
const errors = []
if (!process.env.RESEND_API_KEY?.startsWith('re_')) errors.push('RESEND_API_KEY must be a Resend API key')
if (process.env.APP_ENV !== 'production') errors.push('APP_ENV must be production')
for (const name of required) {
  if (!process.env[name]?.trim()) errors.push(`${name} is required`)
}
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
if (process.env.VITE_CONTACT_ENDPOINT !== '/api/contact') {
  errors.push('VITE_CONTACT_ENDPOINT must use the same-origin production route')
}
if (process.env.CONTACT_FROM_EMAIL !== 'info@purehealthpeptidesshop.com') {
  errors.push('CONTACT_FROM_EMAIL must use the verified Pure Health Peptides mailbox')
}
if (!process.env.RESEND_API_KEY?.startsWith('re_')) errors.push('RESEND_API_KEY must be a Resend API key')
if ((process.env.CRON_SECRET || '').length < 32) errors.push('CRON_SECRET must contain at least 32 characters')
if (!['true', 'false'].includes(process.env.VITE_GOOGLE_AUTH_ENABLED || 'false')) {
  errors.push('VITE_GOOGLE_AUTH_ENABLED must be true or false')
}
let chatwootBaseUrl
try {
  chatwootBaseUrl = new URL(process.env.VITE_CHATWOOT_BASE_URL || '')
  if (chatwootBaseUrl.protocol !== 'https:') errors.push('VITE_CHATWOOT_BASE_URL must use HTTPS')
} catch {
  errors.push('VITE_CHATWOOT_BASE_URL must be a valid URL')
}

if (chatwootBaseUrl?.protocol === 'https:') {
  try {
    const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
    const csp = vercelConfig.headers
      ?.flatMap((rule) => rule.headers || [])
      .find((header) => header.key.toLowerCase() === 'content-security-policy')
      ?.value || ''
    const directiveSources = (directive) => csp
      .split(';')
      .map((value) => value.trim().split(/\s+/))
      .find(([name]) => name === directive)
      ?.slice(1) || []
    const websocketOrigin = `wss://${chatwootBaseUrl.host}`
    const requiredCspSources = [
      ['connect-src', chatwootBaseUrl.origin],
      ['connect-src', websocketOrigin],
      ['frame-src', chatwootBaseUrl.origin],
      ['img-src', chatwootBaseUrl.origin],
      ['script-src', chatwootBaseUrl.origin],
    ]
    for (const [directive, source] of requiredCspSources) {
      if (!directiveSources(directive).includes(source)) {
        errors.push(`Content Security Policy ${directive} must allow ${source}`)
      }
    }
  } catch {
    errors.push('vercel.json must contain a valid Content Security Policy')
  }
}

for (const [name, value] of Object.entries(process.env)) {
  if (!name.startsWith('VITE_')) continue
  if (/secret|service.role|private|webhook|password|token/i.test(name) && !publicClientTokenVariables.has(name)) errors.push(`${name} looks like a secret`)
  if (/^(sk_(test|live)_|whsec_|eyJ[A-Za-z0-9_-]+\.)/.test(value || '')) errors.push(`${name} contains secret-looking data`)
}

if (errors.length) {
  console.error(`Production environment validation failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log('Production environment validation passed.')
