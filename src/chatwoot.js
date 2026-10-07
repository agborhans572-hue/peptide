const SCRIPT_ID = 'chatwoot-sdk-script'

let desiredVisibility = true
let readyListenerInstalled = false
let sdkLoadPromise
let sdkStarted = false

function normalizeEnvironmentValue(value) {
  const normalized = String(value || '').trim()
  const quote = normalized[0]
  if ((quote === '"' || quote === "'") && normalized[normalized.length - 1] === quote) {
    return normalized.slice(1, -1).trim()
  }
  return normalized
}

function chatwootConfiguration() {
  const websiteToken = normalizeEnvironmentValue(import.meta.env.VITE_CHATWOOT_WEBSITE_TOKEN)
  const configuredBaseUrl = normalizeEnvironmentValue(import.meta.env.VITE_CHATWOOT_BASE_URL)
  if (!websiteToken || !configuredBaseUrl) return null

  try {
    const url = new URL(configuredBaseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (import.meta.env.PROD && url.protocol !== 'https:') return null

    return {
      baseUrl: url.href.replace(/\/+$/, ''),
      websiteToken,
    }
  } catch {
    return null
  }
}

function applyVisibility() {
  const chatwoot = window.$chatwoot
  if (!chatwoot) return

  try {
    if (!desiredVisibility) chatwoot.toggle?.('close')
    chatwoot.toggleBubbleVisibility?.(desiredVisibility ? 'show' : 'hide')
  } catch {
    // Chat remains optional if an installed SDK version cannot apply a setting.
  }
}

function ensureReadyListener() {
  if (readyListenerInstalled) return
  window.addEventListener('chatwoot:ready', applyVisibility)
  readyListenerInstalled = true
}

function startSdk(configuration, script) {
  if (sdkStarted || script.dataset.chatwootInitialized === 'true' || window.$chatwoot) {
    sdkStarted = true
    applyVisibility()
    return true
  }

  if (typeof window.chatwootSDK?.run !== 'function') return false

  try {
    window.chatwootSDK.run(configuration)
    script.dataset.chatwootInitialized = 'true'
    sdkStarted = true
    return true
  } catch {
    return false
  }
}

export function setChatwootVisibility(visible) {
  desiredVisibility = Boolean(visible)
  if (window.chatwootSettings) {
    window.chatwootSettings.hideMessageBubble = !desiredVisibility
  }
  applyVisibility()
}

export function loadChatwoot() {
  const configuration = chatwootConfiguration()
  if (!configuration || typeof window === 'undefined') return Promise.resolve(false)

  window.chatwootSettings = {
    darkMode: 'auto',
    hideMessageBubble: !desiredVisibility,
    locale: 'en',
    position: 'right',
    showUnreadMessagesDialog: false,
    type: 'standard',
    useBrowserLanguage: true,
  }
  ensureReadyListener()

  const existingScript = document.getElementById(SCRIPT_ID)
  if (existingScript && startSdk(configuration, existingScript)) return Promise.resolve(true)
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve) => {
    const script = existingScript || document.createElement('script')
    const finish = () => resolve(startSdk(configuration, script))
    const fail = () => {
      if (!existingScript) script.remove()
      resolve(false)
    }

    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', fail, { once: true })

    if (!existingScript) {
      script.id = SCRIPT_ID
      script.src = `${configuration.baseUrl}/packs/js/sdk.js`
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }).then((loaded) => {
    if (!loaded) sdkLoadPromise = undefined
    return loaded
  })

  return sdkLoadPromise
}
