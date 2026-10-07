import { useEffect } from 'react'
import { loadChatwoot, setChatwootVisibility } from './chatwoot.js'

const FALLBACK_DELAY_MS = 1_500

export default function ChatwootWidget({ visible = true }) {
  useEffect(() => {
    setChatwootVisibility(visible)
  }, [visible])

  useEffect(() => {
    let active = true
    let idleCallbackId
    let timeoutId

    const initialize = () => {
      if (active) void loadChatwoot()
    }
    const schedule = () => {
      if ('requestIdleCallback' in window) {
        idleCallbackId = window.requestIdleCallback(initialize, { timeout: 3_000 })
      } else {
        timeoutId = window.setTimeout(initialize, FALLBACK_DELAY_MS)
      }
    }

    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })

    return () => {
      active = false
      window.removeEventListener('load', schedule)
      if (idleCallbackId !== undefined) window.cancelIdleCallback?.(idleCallbackId)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])

  return null
}
