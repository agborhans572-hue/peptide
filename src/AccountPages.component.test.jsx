import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AccountPage } from './AccountPages.jsx'

const state = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./AuthContext.jsx', () => ({ useAuth: () => ({
  config: { configured: true }, user: { id: 'customer' }, loading: false,
  profile: { first_name: 'Alex' }, client: { rpc: state.rpc }, signOut: vi.fn(),
}) }))
vi.mock('./TurnstileChallenge.jsx', () => ({ default: () => null }))

beforeEach(() => {
  state.rpc.mockReset()
  window.history.replaceState({}, '', '/my-account/?order=PHP-00000005')
})

it('shows the submitted request with pending payment, items and delivery address', async () => {
  state.rpc.mockResolvedValue({ data: [{
    id: 'request', order_number: 'PHP-00000005', payment_status: 'awaiting_payment',
    fulfillment_status: 'pending', total_cents: 2498, currency: 'usd',
    order_items: [{ id: 'variant', product_name: 'Acetic Acid', product_option: '10mL', quantity: 1, total_cents: 1399 }],
    shipping_address: { firstName: 'Alex', lastName: 'Morgan', address: '1250 Sample Oak Lane', city: 'Austin', state: 'TX', postalCode: '78701', country: 'United States' },
  }] })
  render(<AccountPage />)
  await screen.findByRole('heading', { name: 'Order PHP-00000005' })
  expect(state.rpc).toHaveBeenCalledWith('list_my_account_orders', { p_order_number: 'PHP-00000005', p_limit: 1 })
  expect(screen.getByText(/Payment and shipment remain pending/)).toBeTruthy()
  expect(screen.getByText(/1 × Acetic Acid/)).toBeTruthy()
  expect(screen.getByText(/1250 Sample Oak Lane/)).toBeTruthy()
})

it('shows an error instead of claiming an empty history when loading fails', async () => {
  window.history.replaceState({}, '', '/my-account/')
  state.rpc.mockResolvedValue({ data: null, error: { message: 'Unavailable' } })
  render(<AccountPage />)
  fireEvent.click(screen.getByRole('button', { name: 'orders' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Your orders could not be loaded')
  expect(screen.queryByText(/No orders have been submitted/)).toBeNull()
})
