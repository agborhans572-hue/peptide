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
  const { loading, user, accountError } = useAuth()
  return <><p>{loading ? 'Loading' : user ? 'Signed in' : 'Signed out'}</p>{accountError && <p role="alert">{accountError}</p>}</>
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
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { first_name: 'Alex', status: 'active' } }) }) }) })),
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

it('loads the dashboard with Supabase thenable requests that have no catch method', async () => {
  mocks.client.rpc.mockImplementation((name) => ({
    then: (resolve) => Promise.resolve({ data: name === 'get_my_account_status'
      ? [{ status: 'active', email_verified: true }] : 0 }).then(resolve),
  }))
  render(<AuthProvider><AccountProbe /></AuthProvider>)
  await screen.findByText('Signed out')
  mocks.listener('SIGNED_IN', { user: { id: 'test-user' }, access_token: 'test-token' })
  await screen.findByText('Signed in')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(mocks.client.rpc).toHaveBeenCalledWith('claim_my_paid_orders')
  expect(mocks.client.auth.signOut).not.toHaveBeenCalled()
})

it('keeps a valid login when the profile service fails and reports a retryable error', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocks.client.rpc.mockResolvedValue({ error: { code: 'PGRST002' } })
  render(<AuthProvider><AccountProbe /></AuthProvider>)
  await screen.findByText('Signed out')
  mocks.listener('SIGNED_IN', { user: { id: 'test-user' }, access_token: 'test-token' })
  await screen.findByRole('alert')
  expect(screen.getByText('Signed in')).toBeTruthy()
  expect(mocks.client.auth.signOut).not.toHaveBeenCalled()
  expect(warning).toHaveBeenCalledWith('Customer account lookup failed', { stage: 'status', code: 'PGRST002' })
  warning.mockRestore()
})

it('does not let a delayed initial session overwrite a newer sign-in', async () => {
  let resolveInitial
  mocks.client.auth.getSession.mockReturnValue(new Promise((resolve) => { resolveInitial = resolve }))
  render(<AuthProvider><AccountProbe /></AuthProvider>)
  await waitFor(() => expect(mocks.client.auth.onAuthStateChange).toHaveBeenCalled())
  mocks.listener('SIGNED_IN', { user: { id: 'test-user' }, access_token: 'test-token' })
  await screen.findByText('Signed in')
  resolveInitial({ data: { session: null } })
  await waitFor(() => expect(screen.getByText('Signed in')).toBeTruthy())
  expect(mocks.client.auth.signOut).not.toHaveBeenCalled()
})
