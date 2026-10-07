import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext.jsx'

const mocks = vi.hoisted(() => ({ client: null, listener: null }))
vi.mock('./supabaseBrowser.js', () => ({
  supabaseConfiguration: () => ({ configured: true }),
  getSupabaseBrowserClient: async () => mocks.client,
  authRedirect: () => 'https://example.test/auth/callback/',
}))

function AccountProbe() {
  const { loading, user } = useAuth()
  return <p>{loading ? 'Loading' : user ? 'Signed in' : 'Signed out'}</p>
}

beforeEach(() => {
  window.history.replaceState({}, '', '/my-account/')
  localStorage.clear()
  mocks.client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn((callback) => {
        mocks.listener = callback
        return { data: { listener: null, subscription: { unsubscribe: vi.fn() } } }
      }),
      signOut: vi.fn(async () => ({})),
    },
    rpc: vi.fn(async (name) => ({ data: name === 'get_my_account_status'
      ? [{ status: 'active', email_verified: true }] : 0 })),
    from: vi.fn(() => ({ select: () => ({ single: async () => ({ data: { first_name: 'Alex', status: 'active' } }) }) })),
  }
})

it('does not erase another tab’s new session when an unauthenticated tab initializes', async () => {
  const lifecycle = { userId: 'test-user', startedAt: Date.now(), lastActivityAt: Date.now() }
  localStorage.setItem('php-customer-session-lifecycle-v1', JSON.stringify(lifecycle))
  render(<AuthProvider><AccountProbe /></AuthProvider>)
  await screen.findByText('Signed out')
  expect(JSON.parse(localStorage.getItem('php-customer-session-lifecycle-v1'))).toEqual(lifecycle)
  expect(mocks.client.auth.signOut).not.toHaveBeenCalled()
})

it('loads the verified customer after sign-in and retains the session on token refresh', async () => {
  render(<AuthProvider><AccountProbe /></AuthProvider>)
  await screen.findByText('Signed out')
  const session = { user: { id: 'test-user' }, access_token: 'test-token' }
  mocks.listener('SIGNED_IN', session)
  await screen.findByText('Signed in')
  mocks.listener('TOKEN_REFRESHED', session)
  await waitFor(() => expect(mocks.client.rpc).toHaveBeenCalledWith('get_my_account_status'))
  expect(mocks.client.auth.signOut).not.toHaveBeenCalled()
})
