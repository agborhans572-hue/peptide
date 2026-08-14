import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  authLinkErrorMessage,
  captchaOptions,
  isRecentAuthentication,
  passwordPolicyError,
  safeAuthError,
  sessionExpiryReason,
} from './authPolicy.js'
import {
  authRedirect,
  getSupabaseBrowserClient,
  supabaseConfiguration,
} from './supabaseBrowser.js'

const AuthContext = createContext(null)
const LIFECYCLE_KEY = 'php-customer-session-lifecycle-v1'
const SESSION_MESSAGE_KEY = 'php-customer-session-message-v1'

function readLifecycle() {
  try {
    const value = JSON.parse(localStorage.getItem(LIFECYCLE_KEY) || 'null')
    return value?.startedAt && value?.lastActivityAt ? value : null
  } catch {
    return null
  }
}

function writeLifecycle(value) {
  try {
    if (value) localStorage.setItem(LIFECYCLE_KEY, JSON.stringify(value))
    else localStorage.removeItem(LIFECYCLE_KEY)
  } catch {
    // Supabase still manages the session when browser storage is unavailable.
  }
}

function storeSessionMessage(message) {
  try {
    if (message) sessionStorage.setItem(SESSION_MESSAGE_KEY, message)
    else sessionStorage.removeItem(SESSION_MESSAGE_KEY)
  } catch {
    // The account page simply omits the one-time message.
  }
}

export function consumeSessionMessage() {
  try {
    const message = sessionStorage.getItem(SESSION_MESSAGE_KEY) || ''
    sessionStorage.removeItem(SESSION_MESSAGE_KEY)
    return message
  } catch {
    return ''
  }
}

function initialLifecycle(userId) {
  const now = Date.now()
  return { userId, startedAt: now, lastActivityAt: now }
}

export function AuthProvider({ children }) {
  const config = useMemo(supabaseConfiguration, [])
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(config.configured)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [accountStatus, setAccountStatus] = useState('')
  const activityWriteAt = useRef(0)

  useEffect(() => {
    if (!config.configured) {
      setLoading(false)
      return undefined
    }
    let active = true
    const initialize = () => {
      getSupabaseBrowserClient()
        .then((nextClient) => { if (active) setClient(nextClient) })
        .catch(() => { if (active) setLoading(false) })
    }
    let hasStoredSession = false
    try {
      hasStoredSession = Object.keys(localStorage).some((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
    } catch {
      // Storage can be unavailable in private browsing or hardened browser profiles.
    }
    const immediate = window.location.pathname.includes('/my-account')
      || window.location.pathname.includes('/auth/')
      || hasStoredSession
    if (immediate) initialize()
    else if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(initialize, { timeout: 2000 })
      return () => { active = false; window.cancelIdleCallback(handle) }
    } else {
      const handle = window.setTimeout(initialize, 1500)
      return () => { active = false; window.clearTimeout(handle) }
    }
    return () => { active = false }
  }, [config.configured])

  const clearCustomerState = useCallback(() => {
    setSession(null)
    setProfile(null)
    setAccountStatus('')
    writeLifecycle(null)
  }, [])

  const signOut = useCallback(async (message = '', scope = 'global') => {
    if (client) await client.auth.signOut({ scope }).catch(() => undefined)
    clearCustomerState()
    storeSessionMessage(message)
  }, [clearCustomerState, client])

  const loadAccount = useCallback(async (activeSession) => {
    if (!client || !activeSession?.user) {
      setProfile(null)
      setAccountStatus('')
      return null
    }
    const { data: statusRows, error: statusError } = await client.rpc('get_my_account_status')
    if (statusError) throw statusError
    const statusRow = statusRows?.[0]
    if (!statusRow || statusRow.status !== 'active' || !statusRow.email_verified) {
      const message = !statusRow?.email_verified
        ? 'Verify your email before using this account. You can request a new verification link.'
        : statusRow?.status === 'suspended'
          ? 'This account is suspended. Contact support if you believe this is an error.'
          : 'This account is unavailable because deletion has been requested.'
      setAccountStatus(statusRow?.status || 'unavailable')
      await signOut(message)
      return null
    }

    const { data: profileRow, error: profileError } = await client
      .from('customer_profiles')
      .select('user_id,email,first_name,last_name,phone,business_name,ein,website_url,status,created_at,updated_at')
      .single()
    if (profileError) throw profileError
    setProfile(profileRow)
    setAccountStatus(profileRow.status)
    await client.rpc('claim_my_paid_orders').catch(() => undefined)
    return profileRow
  }, [client, signOut])

  useEffect(() => {
    if (!client) {
      return undefined
    }
    let mounted = true

    async function applySession(nextSession) {
      if (!mounted) return
      if (!nextSession) {
        clearCustomerState()
        setLoading(false)
        return
      }

      let lifecycle = readLifecycle()
      if (!lifecycle || lifecycle.userId !== nextSession.user.id) {
        lifecycle = initialLifecycle(nextSession.user.id)
        writeLifecycle(lifecycle)
      }
      const expiry = sessionExpiryReason(lifecycle)
      if (expiry) {
        await signOut(
          expiry === 'idle'
            ? 'Your session expired after 12 hours of inactivity. Sign in again.'
            : 'Your session reached its seven-day maximum. Sign in again.',
        )
        setLoading(false)
        return
      }

      setSession(nextSession)
      try {
        await loadAccount(nextSession)
      } catch {
        await signOut('Your account session could not be verified. Sign in again.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    client.auth.getSession().then(({ data }) => applySession(data.session))
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => applySession(nextSession))
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [clearCustomerState, client, loadAccount, signOut])

  useEffect(() => {
    if (!client || !session?.user) return undefined

    const recordActivity = () => {
      const now = Date.now()
      if (now - activityWriteAt.current < 60_000) return
      activityWriteAt.current = now
      const lifecycle = readLifecycle() || initialLifecycle(session.user.id)
      writeLifecycle({ ...lifecycle, userId: session.user.id, lastActivityAt: now })
    }
    const verifyExpiry = () => {
      const reason = sessionExpiryReason(readLifecycle())
      if (!reason) return
      void signOut(
        reason === 'idle'
          ? 'Your session expired after 12 hours of inactivity. Sign in again.'
          : 'Your session reached its seven-day maximum. Sign in again.',
      )
    }
    const handleStorage = (event) => {
      if (event.key !== LIFECYCLE_KEY) return
      if (!event.newValue) void signOut('You were signed out in another browser tab.', 'local')
      else verifyExpiry()
    }

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach((name) => window.addEventListener(name, recordActivity, { passive: true }))
    window.addEventListener('storage', handleStorage)
    const interval = window.setInterval(verifyExpiry, 60_000)
    return () => {
      events.forEach((name) => window.removeEventListener(name, recordActivity))
      window.removeEventListener('storage', handleStorage)
      window.clearInterval(interval)
    }
  }, [client, session, signOut])

  const register = useCallback(async (values, captchaToken) => {
    if (!client) throw new Error('Customer authentication is not configured.')
    const passwordError = passwordPolicyError(values.password)
    if (passwordError) throw new Error(passwordError)
    const redirectTo = authRedirect('/auth/callback/')
    if (!redirectTo) throw new Error('The production auth redirect is not configured.')
    const { error } = await client.auth.signUp({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      options: {
        ...captchaOptions(captchaToken),
        emailRedirectTo: redirectTo,
        data: {
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          phone: values.phone.trim(),
          business_name: values.businessName.trim(),
          ein: values.ein.trim(),
          website_url: values.websiteUrl.trim(),
        },
      },
    })
    if (error) throw error
    return 'If this address can be registered, a verification email is on its way. Check your inbox and spam folder.'
  }, [client])

  const login = useCallback(async (email, password, captchaToken) => {
    if (!client) throw new Error('Customer authentication is not configured.')
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
      options: captchaOptions(captchaToken),
    })
    if (error) throw new Error(safeAuthError(error), { cause: error })
    await loadAccount(data.session)
    return data
  }, [client, loadAccount])

  const loginWithGoogle = useCallback(async () => {
    if (!client || !config.googleEnabled) throw new Error('Google sign-in is not enabled.')
    const redirectTo = authRedirect('/auth/callback/')
    if (!redirectTo) throw new Error('The production auth redirect is not configured.')
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
  }, [client, config.googleEnabled])

  const resendVerification = useCallback(async (email, captchaToken) => {
    if (!client) throw new Error('Customer authentication is not configured.')
    const emailRedirectTo = authRedirect('/auth/callback/')
    const { error } = await client.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        ...captchaOptions(captchaToken),
        emailRedirectTo,
      },
    })
    if (error) throw error
    return 'If the address has an unverified account, a new verification link is on its way.'
  }, [client])

  const requestPasswordReset = useCallback(async (email, captchaToken) => {
    if (!client) throw new Error('Customer authentication is not configured.')
    const redirectTo = authRedirect('/auth/reset-password/')
    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      ...captchaOptions(captchaToken),
      redirectTo,
    })
    if (error) throw error
    return 'If an account exists for that address, a password-reset link is on its way.'
  }, [client])

  const handleAuthCode = useCallback(async (url = window.location.href) => {
    if (!client) throw new Error('Customer authentication is not configured.')
    const parsed = new URL(url)
    const errorCode = parsed.searchParams.get('error_code') || parsed.searchParams.get('error')
    const description = parsed.searchParams.get('error_description') || ''
    if (errorCode) throw new Error(authLinkErrorMessage(errorCode, description))
    const code = parsed.searchParams.get('code')
    if (!code) throw new Error(authLinkErrorMessage('missing_code'))
    const { data, error } = await client.auth.exchangeCodeForSession(code)
    if (error) throw new Error(authLinkErrorMessage(error.code, error.message), { cause: error })
    await loadAccount(data.session)
    return data
  }, [client, loadAccount])

  const updateProfile = useCallback(async (values) => {
    const { data, error } = await client.rpc('update_my_profile', {
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_phone: values.phone,
      p_business_name: values.businessName || null,
      p_ein: values.ein || null,
      p_website_url: values.websiteUrl || null,
    })
    if (error) throw error
    setProfile(data)
    return data
  }, [client])

  const reauthenticatePassword = useCallback(async (password, captchaToken) => {
    if (!session?.user?.email) throw new Error('Sign in again before continuing.')
    const { data, error } = await client.auth.signInWithPassword({
      email: session.user.email,
      password,
      options: captchaOptions(captchaToken),
    })
    if (error) throw new Error(safeAuthError(error, 'The current password is incorrect.'), { cause: error })
    if (!data.session) throw new Error('Sign in again before continuing.')
    writeLifecycle(initialLifecycle(data.session.user.id))
    setSession(data.session)
    await loadAccount(data.session)
    return data.session
  }, [client, loadAccount, session])

  const updatePassword = useCallback(async (password) => {
    const passwordError = passwordPolicyError(password)
    if (passwordError) throw new Error(passwordError)
    const { error } = await client.auth.updateUser({ password })
    if (error) throw error
  }, [client])

  const updateEmail = useCallback(async (email) => {
    const emailRedirectTo = authRedirect('/auth/callback/')
    const { error } = await client.auth.updateUser(
      { email: email.trim().toLowerCase() },
      { emailRedirectTo },
    )
    if (error) throw error
  }, [client])

  const value = useMemo(() => ({
    accountStatus,
    client,
    config,
    handleAuthCode,
    isRecent: isRecentAuthentication(session?.access_token),
    loading,
    login,
    loginWithGoogle,
    profile,
    reauthenticatePassword,
    register,
    requestPasswordReset,
    resendVerification,
    session,
    signOut,
    updateEmail,
    updatePassword,
    updateProfile,
    user: session?.user || null,
  }), [
    accountStatus, client, config, handleAuthCode, loading, login, loginWithGoogle,
    profile, reauthenticatePassword, register, requestPasswordReset,
    resendVerification, session, signOut, updateEmail, updatePassword, updateProfile,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
