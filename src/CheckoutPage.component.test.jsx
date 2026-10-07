import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckoutPage, OrderConfirmationPage } from './CheckoutPage.jsx'

vi.mock('./TurnstileChallenge.jsx', () => ({ default: ({ onToken }) => <button type="button" onClick={() => onToken('verified')}>Verify security</button> }))

it('preserves delivery details when submission fails and passes agreement and security token', async () => {
  const submit = vi.fn().mockRejectedValue(new Error('Please try again'))
  render(<CheckoutPage items={[{ key: 'one', product: { name: 'Test' }, quantity: 1, total: 22, option: '5mg' }]} onPlaceOrder={submit} />)
  const values = { email: 'customer@example.com', phone: '5551234567', firstName: 'Jane', lastName: 'Smith', company: 'Lab', address: '123 Main St', address2: 'Suite 2', city: 'Boston', state: 'MA', postalCode: '02101' }
  for (const [name, value] of Object.entries(values)) fireEvent.change(document.querySelector(`[name="${name}"]`), { target: { value } })
  fireEvent.click(document.querySelector('[name="researchAgreement"]'))
  fireEvent.click(screen.getByText('Verify security'))
  fireEvent.click(screen.getByRole('button', { name: /SUBMIT ORDER REQUEST/ }))
  await screen.findByText('Please try again')
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ captchaToken: 'verified', researchAgreement: true, customer: expect.objectContaining(values) }))
  expect(document.querySelector('[name="address"]').value).toBe('123 Main St')
  expect(screen.getByRole('button', { name: /SUBMIT ORDER REQUEST/ }).disabled).toBe(false)
})

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
