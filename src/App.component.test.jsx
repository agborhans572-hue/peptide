import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

vi.mock('./AuthContext.jsx', () => ({ useAuth: () => ({ session: null }) }))

describe('application delivery shell', () => {
  beforeEach(() => localStorage.setItem('php-research-confirmed', 'true'))

  it('recovers compact cart identifiers against the active catalog', async () => {
    localStorage.setItem('php-research-cart-v1', JSON.stringify({
      catalogVersion: 'older-catalog-is-rehydrated-line-by-line',
      items: [{ productId: 'vials-419', variantId: '420', quantity: 2 }],
    }))
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Open cart' }))
    expect(await screen.findByText('BPC-157')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('php-research-cart-v1')).items).toEqual([
      { productId: 'vials-419', variantId: '420', quantity: 2 },
    ])
  })

  it('renders a lazy shop route through the declarative router', async () => {
    render(<MemoryRouter initialEntries={['/shop/']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { level: 1, name: 'Research Peptides for Laboratory Use' }, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByRole('button', { name: /LOAD MORE Vials/i })).toBeTruthy()
  }, 15_000)

  it('contains route render failures in the application error boundary', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    function BrokenRoute() { throw new Error('route failed') }
    render(<ErrorBoundary><BrokenRoute /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /couldn.t load this page/i })).toBeTruthy()
    consoleError.mockRestore()
  })
})
