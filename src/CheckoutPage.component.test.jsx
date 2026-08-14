import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrderConfirmationPage } from './CheckoutPage.jsx'

describe('order confirmation projection', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps a pending state for HTTP 202 and resolves from the local order projection', async () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/order-confirmation/?session_id=cs_test_pending')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ pending: true }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({
        orderNumber: 'PHP-TEST-1',
        paymentStatus: 'paid',
        fulfillmentStatus: 'ready',
        totalCents: 3299,
        currency: 'usd',
      }))
    vi.stubGlobal('fetch', fetchMock)

    render(<OrderConfirmationPage order={null} onShop={() => {}} />)
    await act(async () => Promise.resolve())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Do not close this page/)).toBeTruthy()

    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByText('PHP-TEST-1')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Thank you for your order.' })).toBeTruthy()
  })
})
