import { useEffect, useRef } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function useDialogFocus(open, onClose, options = {}) {
  const containerRef = useRef(null)
  const closeRef = useRef(onClose)
  const initialFocusRef = useRef(options.initialFocusRef)
  const closeOnEscape = options.closeOnEscape !== false

  closeRef.current = onClose
  initialFocusRef.current = options.initialFocusRef

  useEffect(() => {
    if (!open) return undefined

    const container = containerRef.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!container) return undefined

    const focusInitialElement = () => {
      const preferred = initialFocusRef.current?.current
      const first = container.querySelector(focusableSelector)
      const target = preferred || first || container
      target.focus({ preventScroll: true })
    }
    const animationFrame = requestAnimationFrame(focusInitialElement)

    function handleKeyDown(event) {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault()
        closeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = [...container.querySelectorAll(focusableSelector)]
        .filter((element) => !element.closest('[inert]') && element.getClientRects().length > 0)
      if (focusable.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(animationFrame)
      document.removeEventListener('keydown', handleKeyDown)
      if (trigger?.isConnected) requestAnimationFrame(() => trigger.focus({ preventScroll: true }))
    }
  }, [open, closeOnEscape])

  return containerRef
}
