let browserClient
let browserClientPromise

export function normalizeSiteOrigin(siteUrl) {
  const value = String(siteUrl || '').trim().replace(/\/+$/, '')
  if (!value) return ''
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function configuredSiteUrl() {
  return normalizeSiteOrigin(import.meta.env.VITE_SITE_URL)
}

export function canonicalAuthRedirect(siteUrl, path) {
  const origin = normalizeSiteOrigin(siteUrl)
  return origin ? new URL(path, `${origin}/`).href : ''
}

export function authRedirect(path) {
  return canonicalAuthRedirect(configuredSiteUrl(), path)
}

export function supabaseConfiguration() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
  const siteUrl = configuredSiteUrl()
  const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim()
  return {
    configured: Boolean(url && publishableKey && siteUrl && turnstileSiteKey),
    googleEnabled: String(import.meta.env.VITE_GOOGLE_AUTH_ENABLED || '').toLowerCase() === 'true',
    publishableKey,
    siteUrl,
    turnstileSiteKey,
    url,
  }
}

export async function getSupabaseBrowserClient() {
  if (browserClient) return browserClient
  if (browserClientPromise) return browserClientPromise
  const config = supabaseConfiguration()
  if (!config.configured || typeof window === 'undefined') return null

  browserClientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
    browserClient = createClient(config.url, config.publishableKey, {
      auth: {
        detectSessionInUrl: false,
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
      },
    })
    return browserClient
  })
  return browserClientPromise
}
