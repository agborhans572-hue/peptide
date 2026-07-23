import { useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'

const SCRIPT_ID = 'cloudflare-turnstile-script'
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID)
    const script = existing || document.createElement('script')
    const timeout = window.setTimeout(() => reject(new Error('The security check did not load. Refresh and try again.')), 15_000)

    const finish = () => {
      window.clearTimeout(timeout)
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('The security check is unavailable. Refresh and try again.'))
    }
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => {
      window.clearTimeout(timeout)
      reject(new Error('The security check did not load. Refresh and try again.'))
    }, { once: true })

    if (!existing) {
      script.id = SCRIPT_ID
      script.src = SCRIPT_URL
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }).catch((error) => {
    scriptPromise = undefined
    throw error
  })
  return scriptPromise
}

export default function TurnstileChallenge({ action, onToken, resetKey = 0 }) {
  const { config } = useAuth()
  const container = useRef(null)
  const widgetId = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    onToken('')
    setError('')

    loadTurnstile().then((turnstile) => {
      if (!active || !container.current) return
      widgetId.current = turnstile.render(container.current, {
        action,
        appearance: 'interaction-only',
        callback: (token) => {
          if (active) onToken(token)
        },
        'error-callback': () => {
          if (!active) return
          onToken('')
          setError('The security check could not be completed. Try again.')
        },
        'expired-callback': () => {
          if (!active) return
          onToken('')
          setError('The security check expired. Complete it again.')
        },
        sitekey: config.turnstileSiteKey,
        theme: 'light',
      })
    }).catch((caught) => {
      if (active) setError(caught.message)
    })

    return () => {
      active = false
      onToken('')
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current)
      }
      widgetId.current = null
    }
  }, [action, config.turnstileSiteKey, onToken, resetKey])

  return (
    <div className="account-turnstile">
      <div ref={container} />
      {error && <p className="account-status is-error" role="alert">{error}</p>}
    </div>
  )
}
