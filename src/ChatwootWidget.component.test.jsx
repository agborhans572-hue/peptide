import { StrictMode } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('ChatwootWidget', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_CHATWOOT_WEBSITE_TOKEN', '')
    vi.stubEnv('VITE_CHATWOOT_BASE_URL', '')
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' })
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: vi.fn((callback) => {
        callback()
        return 1
      }),
    })
    Object.defineProperty(window, 'cancelIdleCallback', { configurable: true, value: vi.fn() })
  })

  afterEach(() => {
    document.getElementById('chatwoot-sdk-script')?.remove()
    delete window.$chatwoot
    delete window.chatwootSDK
    delete window.chatwootSettings
    vi.unstubAllEnvs()
  })

  it('stays disabled without public widget configuration', async () => {
    const { default: ChatwootWidget } = await import('./ChatwootWidget.jsx')
    render(<ChatwootWidget />)

    expect(document.getElementById('chatwoot-sdk-script')).toBeNull()
  })

  it('loads once and follows app-level visibility changes', async () => {
    vi.stubEnv('VITE_CHATWOOT_WEBSITE_TOKEN', '"public-website-token"')
    vi.stubEnv('VITE_CHATWOOT_BASE_URL', 'https://app.chatwoot.com/')
    const { default: ChatwootWidget } = await import('./ChatwootWidget.jsx')
    const view = render(<StrictMode><ChatwootWidget /></StrictMode>)
    const script = document.getElementById('chatwoot-sdk-script')
    const run = vi.fn()

    expect(script?.src).toBe('https://app.chatwoot.com/packs/js/sdk.js')
    expect(document.querySelectorAll('#chatwoot-sdk-script')).toHaveLength(1)
    window.chatwootSDK = { run }
    fireEvent.load(script)

    expect(run).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledWith({
      baseUrl: 'https://app.chatwoot.com',
      websiteToken: 'public-website-token',
    })
    expect(window.chatwootSettings).toMatchObject({
      position: 'right',
      showUnreadMessagesDialog: false,
      type: 'standard',
      useBrowserLanguage: true,
    })

    const toggle = vi.fn()
    const toggleBubbleVisibility = vi.fn()
    window.$chatwoot = { toggle, toggleBubbleVisibility }
    window.dispatchEvent(new Event('chatwoot:ready'))
    expect(toggleBubbleVisibility).toHaveBeenLastCalledWith('show')

    view.rerender(<StrictMode><ChatwootWidget visible={false} /></StrictMode>)
    expect(toggle).toHaveBeenLastCalledWith('close')
    expect(toggleBubbleVisibility).toHaveBeenLastCalledWith('hide')
  })
})
