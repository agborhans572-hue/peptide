import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, KeyRound, LogOut, ShieldAlert } from 'lucide-react'
import {
  MINIMUM_PASSWORD_LENGTH,
  VERIFICATION_RESEND_COOLDOWN_MS,
  passwordPolicyError,
  safeAuthError,
} from './authPolicy.js'
import { consumeSessionMessage, useAuth } from './AuthContext.jsx'
import { appPath } from './appPath.js'
import { postToSiteService, safeServiceMessage, siteServices } from './siteServices.js'
import TurnstileChallenge from './TurnstileChallenge.jsx'
import './account.css'

function Status({ children, error = false }) {
  return children ? <p className={`account-status${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{children}</p> : null
}

function Field({
  label, name, type = 'text', required = false, defaultValue = '', autoComplete, minLength, children,
}) {
  return (
    <label>
      {label}{required && <span aria-hidden="true"> *</span>}
      {children || (
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue || ''}
          autoComplete={autoComplete}
          minLength={minLength}
        />
      )}
    </label>
  )
}

function LoginPanel({ onRegisteredEmail }) {
  const { config, login, loginWithGoogle, requestPasswordReset, resendVerification } = useAuth()
  const [status, setStatus] = useState(consumeSessionMessage)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const [recoveryCaptchaToken, setRecoveryCaptchaToken] = useState('')
  const [recoveryCaptchaReset, setRecoveryCaptchaReset] = useState(0)

  function resetCaptcha() {
    setCaptchaToken('')
    setCaptchaReset((value) => value + 1)
  }

  async function submitLogin(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    setPending(true)
    setError(false)
    try {
      const form = new FormData(event.currentTarget)
      await login(String(form.get('email')), String(form.get('password')), captchaToken)
      setStatus('Signed in securely.')
    } catch (caught) {
      setError(true)
      setStatus(caught.message)
    } finally {
      setPending(false)
      resetCaptcha()
    }
  }

  async function submitRecovery(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    setPending(true)
    setError(false)
    try {
      setStatus(await requestPasswordReset(
        new FormData(event.currentTarget).get('email'),
        recoveryCaptchaToken,
      ))
    } catch (caught) {
      setError(true)
      setStatus(safeAuthError(caught))
    } finally {
      setPending(false)
      setRecoveryCaptchaToken('')
      setRecoveryCaptchaReset((value) => value + 1)
    }
  }

  async function resend() {
    const email = document.querySelector('#account-login-email')?.value?.trim() || onRegisteredEmail
    if (!email) {
      setError(true)
      setStatus('Enter your email address before requesting a new verification link.')
      return
    }
    if (Date.now() < resendAt) {
      setError(true)
      setStatus('Please wait before requesting another verification link.')
      return
    }
    setPending(true)
    setError(false)
    try {
      setStatus(await resendVerification(email, captchaToken))
      setResendAt(Date.now() + VERIFICATION_RESEND_COOLDOWN_MS)
    } catch (caught) {
      setError(true)
      setStatus(safeAuthError(caught))
    } finally {
      setPending(false)
      resetCaptcha()
    }
  }

  return (
    <article>
      <h1>Customer login</h1>
      <form className="account-card" onSubmit={submitLogin}>
        <Field label="Email address" name="email" type="email" required autoComplete="email">
          <input id="account-login-email" name="email" type="email" required autoComplete="email" defaultValue={onRegisteredEmail} />
        </Field>
        <Field label="Password" name="password" type="password" required autoComplete="current-password" />
        <TurnstileChallenge action="customer_login" onToken={setCaptchaToken} resetKey={captchaReset} />
        <button type="submit" disabled={pending}>{pending ? 'SIGNING IN…' : 'SIGN IN'}</button>
        {config.googleEnabled && (
          <button className="account-secondary-button" type="button" disabled={pending} onClick={() => loginWithGoogle().catch((caught) => {
            setError(true)
            setStatus(safeAuthError(caught))
          })}>
            CONTINUE WITH GOOGLE
          </button>
        )}
        <div className="account-text-actions">
          <button type="button" onClick={() => setRecoveryOpen((value) => !value)}>Forgot password?</button>
          <button type="button" onClick={resend}>Resend verification</button>
        </div>
        <Status error={error}>{status}</Status>
      </form>

      {recoveryOpen && (
        <form className="account-card account-recovery-card" onSubmit={submitRecovery}>
          <h2>Reset your password</h2>
          <p>We’ll send a one-hour recovery link if the address belongs to an account.</p>
          <Field label="Email address" name="email" type="email" required autoComplete="email" />
          <TurnstileChallenge
            action="password_recovery"
            onToken={setRecoveryCaptchaToken}
            resetKey={recoveryCaptchaReset}
          />
          <button type="submit" disabled={pending}>SEND RESET LINK</button>
        </form>
      )}
    </article>
  )
}

function RegistrationPanel({ onRegistered }) {
  const { register } = useAuth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)

  async function submit(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    const policyError = passwordPolicyError(password)
    if (policyError) {
      setError(true)
      setStatus(policyError)
      return
    }
    if (password !== String(form.get('password_confirmation'))) {
      setError(true)
      setStatus('The password confirmation does not match.')
      return
    }
    setPending(true)
    setError(false)
    try {
      const email = String(form.get('email')).trim().toLowerCase()
      const message = await register({
        firstName: String(form.get('first_name')),
        lastName: String(form.get('last_name')),
        phone: String(form.get('phone')),
        businessName: String(form.get('business_name')),
        ein: String(form.get('ein')),
        websiteUrl: String(form.get('website_url')),
        email,
        password,
      }, captchaToken)
      setStatus(message)
      onRegistered(email)
      event.currentTarget.reset()
    } catch (caught) {
      setError(true)
      setStatus(safeAuthError(caught))
    } finally {
      setPending(false)
      setCaptchaToken('')
      setCaptchaReset((value) => value + 1)
    }
  }

  return (
    <article>
      <h1>Create an account</h1>
      <form className="account-card account-registration-card" onSubmit={submit}>
        <div className="account-field-grid">
          <Field label="First name" name="first_name" required autoComplete="given-name" />
          <Field label="Last name" name="last_name" required autoComplete="family-name" />
        </div>
        <Field label="Phone number" name="phone" type="tel" required autoComplete="tel" />
        <Field label="Business name" name="business_name" autoComplete="organization" />
        <Field label="EIN" name="ein" />
        <Field label="Website URL" name="website_url" type="url" autoComplete="url" />
        <Field label="Email address" name="email" type="email" required autoComplete="email" />
        <div className="account-field-grid">
          <Field label="Password" name="password" type="password" required minLength={MINIMUM_PASSWORD_LENGTH} autoComplete="new-password" />
          <Field label="Confirm password" name="password_confirmation" type="password" required minLength={MINIMUM_PASSWORD_LENGTH} autoComplete="new-password" />
        </div>
        <p className="account-help">Use at least {MINIMUM_PASSWORD_LENGTH} characters. You must verify your email before protected account data becomes available.</p>
        <TurnstileChallenge action="customer_signup" onToken={setCaptchaToken} resetKey={captchaReset} />
        <button type="submit" disabled={pending}>{pending ? 'CREATING…' : 'CREATE ACCOUNT'}</button>
        <Status error={error}>{status}</Status>
      </form>
    </article>
  )
}

function ProfileSection() {
  const { profile, updateProfile } = useAuth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(false)
    try {
      await updateProfile({
        firstName: String(form.get('first_name')),
        lastName: String(form.get('last_name')),
        phone: String(form.get('phone')),
        businessName: String(form.get('business_name')),
        ein: String(form.get('ein')),
        websiteUrl: String(form.get('website_url')),
      })
      setStatus('Profile updated.')
    } catch {
      setError(true)
      setStatus('The profile could not be updated. Review the fields and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="account-dashboard-card" onSubmit={submit}>
      <h2>Profile</h2>
      <Field label="Email" name="email" type="email" defaultValue={profile?.email} autoComplete="email">
        <input name="email" type="email" value={profile?.email || ''} readOnly aria-describedby="profile-email-help" />
      </Field>
      <small id="profile-email-help">Change your email from Security after confirming a recent sign-in.</small>
      <div className="account-field-grid">
        <Field label="First name" name="first_name" required defaultValue={profile?.first_name} autoComplete="given-name" />
        <Field label="Last name" name="last_name" required defaultValue={profile?.last_name} autoComplete="family-name" />
      </div>
      <Field label="Phone" name="phone" type="tel" required defaultValue={profile?.phone} autoComplete="tel" />
      <Field label="Business name" name="business_name" defaultValue={profile?.business_name} autoComplete="organization" />
      <Field label="EIN" name="ein" defaultValue={profile?.ein} />
      <Field label="Website URL" name="website_url" type="url" defaultValue={profile?.website_url} autoComplete="url" />
      <button type="submit" disabled={pending}>SAVE PROFILE</button>
      <Status error={error}>{status}</Status>
    </form>
  )
}

function AddressSection() {
  const { client } = useAuth()
  const [address, setAddress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    client.from('customer_addresses').select('*').maybeSingle().then(({ data }) => {
      if (active) {
        setAddress(data)
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [client])

  async function submit(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    setError(false)
    const form = new FormData(event.currentTarget)
    const { data, error: requestError } = await client.rpc('upsert_my_address', {
      p_first_name: String(form.get('first_name')),
      p_last_name: String(form.get('last_name')),
      p_company: String(form.get('company')) || null,
      p_address_line_1: String(form.get('address_line_1')),
      p_address_line_2: String(form.get('address_line_2')) || null,
      p_city: String(form.get('city')),
      p_state: String(form.get('state')).toUpperCase(),
      p_postal_code: String(form.get('postal_code')),
    })
    if (requestError) {
      setError(true)
      setStatus('The address could not be saved. Use a two-letter state and valid U.S. ZIP code.')
      return
    }
    setAddress(data)
    setStatus('Default shipping address updated.')
  }

  if (loading) return <div className="account-dashboard-card"><h2>Address</h2><p>Loading address…</p></div>
  return (
    <form className="account-dashboard-card" key={address?.updated_at || 'new'} onSubmit={submit}>
      <h2>Default U.S. shipping address</h2>
      <div className="account-field-grid">
        <Field label="First name" name="first_name" required defaultValue={address?.first_name} autoComplete="given-name" />
        <Field label="Last name" name="last_name" required defaultValue={address?.last_name} autoComplete="family-name" />
      </div>
      <Field label="Company" name="company" defaultValue={address?.company} autoComplete="organization" />
      <Field label="Address line 1" name="address_line_1" required defaultValue={address?.address_line_1} autoComplete="address-line1" />
      <Field label="Address line 2" name="address_line_2" defaultValue={address?.address_line_2} autoComplete="address-line2" />
      <div className="account-address-grid">
        <Field label="City" name="city" required defaultValue={address?.city} autoComplete="address-level2" />
        <Field label="State" name="state" required defaultValue={address?.state} autoComplete="address-level1" />
        <Field label="ZIP code" name="postal_code" required defaultValue={address?.postal_code} autoComplete="postal-code" />
      </div>
      <p className="account-help">Country: United States. International shipping is unavailable.</p>
      <button type="submit">SAVE ADDRESS</button>
      <Status error={error}>{status}</Status>
    </form>
  )
}

function formatMoney(cents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency).toUpperCase() }).format(Number(cents || 0) / 100)
}

function OrdersSection() {
  const { client } = useAuth()
  const selectedOrder = new URLSearchParams(window.location.search).get('order')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    client.from('orders')
      .select('id,order_number,payment_status,fulfillment_status,currency,total_cents,created_at,order_items(id,sku,product_name,product_option,quantity,total_cents)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active) {
          setOrders(data || [])
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [client])

  if (loading) return <div className="account-dashboard-card"><h2>Orders</h2><p>Loading orders…</p></div>
  if (selectedOrder) {
    const order = orders.find((item) => item.order_number === selectedOrder)
    if (!order) {
      return <div className="account-dashboard-card"><h2>Order not found</h2><p>That order does not exist or is not available to this account.</p></div>
    }
    return (
      <div className="account-dashboard-card">
        <h2>Order {order.order_number}</h2>
        <p><strong>{formatMoney(order.total_cents, order.currency)}</strong> · {order.payment_status} · {order.fulfillment_status}</p>
        <ul className="account-order-items">
          {order.order_items.map((item) => (
            <li key={item.id}>
              <span>{item.quantity} × {item.product_name} — {item.product_option}</span>
              <span>{formatMoney(item.total_cents, order.currency)}</span>
            </li>
          ))}
        </ul>
        <a className="account-inline-link" href={appPath('/my-account/')}>Back to all orders</a>
      </div>
    )
  }
  return (
    <div className="account-dashboard-card">
      <h2>Orders</h2>
      {!orders.length && <p>No paid orders are attached to this verified account yet.</p>}
      <div className="account-orders">
        {orders.map((order) => (
          <a key={order.id} href={`${appPath('/my-account/')}?order=${encodeURIComponent(order.order_number)}`}>
            <span><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleDateString()}</small></span>
            <span>{formatMoney(order.total_cents, order.currency)}<small>{order.fulfillment_status}</small></span>
          </a>
        ))}
      </div>
    </div>
  )
}

function SecuritySection() {
  const {
    isRecent, loginWithGoogle, reauthenticatePassword, updateEmail, updatePassword, user,
  } = useAuth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState(false)
  const [passwordCaptchaToken, setPasswordCaptchaToken] = useState('')
  const [passwordCaptchaReset, setPasswordCaptchaReset] = useState(0)
  const [emailCaptchaToken, setEmailCaptchaToken] = useState('')
  const [emailCaptchaReset, setEmailCaptchaReset] = useState(0)

  const passwordProvider = useMemo(
    () => (user?.app_metadata?.providers || []).includes('email'),
    [user],
  )

  async function ensureRecent(form, captchaToken) {
    if (isRecent) return true
    if (!passwordProvider) {
      await loginWithGoogle()
      return false
    }
    await reauthenticatePassword(String(form.get('current_password')), captchaToken)
    return true
  }

  async function changePassword(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('new_password'))
    const policyError = passwordPolicyError(password)
    if (policyError) {
      setError(true)
      setStatus(policyError)
      return
    }
    if (password !== String(form.get('password_confirmation'))) {
      setError(true)
      setStatus('The password confirmation does not match.')
      return
    }
    try {
      if (!await ensureRecent(form, passwordCaptchaToken)) return
      await updatePassword(password)
      event.currentTarget.reset()
      setError(false)
      setStatus('Password updated. Other refresh sessions will be rotated or invalidated by Supabase.')
    } catch (caught) {
      setError(true)
      setStatus(safeAuthError(caught, caught.message))
    } finally {
      setPasswordCaptchaToken('')
      setPasswordCaptchaReset((value) => value + 1)
    }
  }

  async function changeEmail(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      if (!await ensureRecent(form, emailCaptchaToken)) return
      await updateEmail(String(form.get('new_email')))
      event.currentTarget.reset()
      setError(false)
      setStatus('Check both the current and new email inboxes to finish the verified email change.')
    } catch (caught) {
      setError(true)
      setStatus(safeAuthError(caught, caught.message))
    } finally {
      setEmailCaptchaToken('')
      setEmailCaptchaReset((value) => value + 1)
    }
  }

  return (
    <div className="account-security-grid">
      <form className="account-dashboard-card" onSubmit={changePassword}>
        <h2>Change password</h2>
        {!isRecent && passwordProvider && <Field label="Current password" name="current_password" type="password" required autoComplete="current-password" />}
        {!isRecent && !passwordProvider && <p>Continue with Google to confirm your identity before changing security details.</p>}
        <Field label="New password" name="new_password" type="password" required minLength={MINIMUM_PASSWORD_LENGTH} autoComplete="new-password" />
        <Field label="Confirm new password" name="password_confirmation" type="password" required minLength={MINIMUM_PASSWORD_LENGTH} autoComplete="new-password" />
        {!isRecent && passwordProvider && (
          <TurnstileChallenge
            action="password_reauthentication"
            onToken={setPasswordCaptchaToken}
            resetKey={passwordCaptchaReset}
          />
        )}
        <button type="submit">UPDATE PASSWORD</button>
      </form>
      <form className="account-dashboard-card" onSubmit={changeEmail}>
        <h2>Change verified email</h2>
        {!isRecent && passwordProvider && <Field label="Current password" name="current_password" type="password" required autoComplete="current-password" />}
        {!isRecent && !passwordProvider && <p>Continue with Google to confirm your identity before changing security details.</p>}
        <Field label="New email" name="new_email" type="email" required autoComplete="email" />
        {!isRecent && passwordProvider && (
          <TurnstileChallenge
            action="email_reauthentication"
            onToken={setEmailCaptchaToken}
            resetKey={emailCaptchaReset}
          />
        )}
        <button type="submit">REQUEST EMAIL CHANGE</button>
      </form>
      <Status error={error}>{status}</Status>
    </div>
  )
}

function DeletionSection() {
  const { isRecent, reauthenticatePassword, session, signOut, user } = useAuth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const providers = user?.app_metadata?.providers || []
  const passwordProvider = providers.includes('email')

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (String(form.get('confirmation')).trim().toUpperCase() !== 'DELETE') {
      setError(true)
      setStatus('Type DELETE to confirm the request.')
      return
    }
    try {
      let activeSession = session
      if (!isRecent) {
        if (!passwordProvider) throw new Error('Sign in with Google again, then return here within 15 minutes.')
        activeSession = await reauthenticatePassword(String(form.get('current_password')), captchaToken)
      }
      await postToSiteService(siteServices.accountDeletionEndpoint, { confirmation: 'DELETE' }, {
        accessToken: activeSession.access_token,
      })
      await signOut('Your deletion request is scheduled. Protected account access is now disabled.', 'local')
      window.location.assign(appPath('/my-account/'))
    } catch (caught) {
      setError(true)
      setStatus(safeServiceMessage(caught, caught.message || 'The deletion request could not be submitted.'))
    } finally {
      setCaptchaToken('')
      setCaptchaReset((value) => value + 1)
    }
  }

  return (
    <form className="account-dashboard-card account-danger-card" onSubmit={submit}>
      <h2>Request account deletion</h2>
      <p>Access is disabled immediately. Eligible data is deleted after 30 days. Financial order records may be retained and anonymized when required.</p>
      {!isRecent && passwordProvider && <Field label="Current password" name="current_password" type="password" required autoComplete="current-password" />}
      {!isRecent && passwordProvider && (
        <TurnstileChallenge
          action="deletion_reauthentication"
          onToken={setCaptchaToken}
          resetKey={captchaReset}
        />
      )}
      <Field label='Type "DELETE" to confirm' name="confirmation" required />
      <button type="submit">REQUEST DELETION</button>
      <Status error={error}>{status}</Status>
    </form>
  )
}

function Dashboard() {
  const { profile, signOut } = useAuth()
  const [section, setSection] = useState(() => new URLSearchParams(window.location.search).has('order') ? 'orders' : 'profile')
  const sections = ['profile', 'address', 'orders', 'security', 'deletion']

  return (
    <section className="account-dashboard">
      <header className="account-dashboard-header">
        <div>
          <span className="account-eyebrow">Verified customer account</span>
          <h1>Welcome, {profile?.first_name || 'researcher'}</h1>
        </div>
        <button className="account-logout" type="button" onClick={() => signOut('You signed out successfully.')}>
          <LogOut size={17} aria-hidden="true" /> Sign out everywhere
        </button>
      </header>
      <nav className="account-tabs" aria-label="Customer account sections">
        {sections.map((item) => (
          <button key={item} className={section === item ? 'is-active' : ''} type="button" onClick={() => setSection(item)}>
            {item === 'deletion' ? 'Account deletion' : item}
          </button>
        ))}
      </nav>
      {section === 'profile' && <ProfileSection />}
      {section === 'address' && <AddressSection />}
      {section === 'orders' && <OrdersSection />}
      {section === 'security' && <SecuritySection />}
      {section === 'deletion' && <DeletionSection />}
    </section>
  )
}

export function AccountPage() {
  const { config, loading, user } = useAuth()
  const [registeredEmail, setRegisteredEmail] = useState('')

  if (loading) {
    return <section className="account-state-page"><KeyRound aria-hidden="true" /><h1>Checking your account…</h1></section>
  }
  if (!config.configured) {
    return (
      <section className="account-state-page">
        <ShieldAlert aria-hidden="true" />
        <h1>Customer account setup required</h1>
        <p>Add the public Supabase URL, publishable key, site URL, and Turnstile site key to this deployment. No service-role secret belongs in browser variables.</p>
      </section>
    )
  }
  if (user) return <Dashboard />
  return (
    <div className="support-page account-page">
      <section className="account-layout">
        <LoginPanel onRegisteredEmail={registeredEmail} />
        <RegistrationPanel onRegistered={setRegisteredEmail} />
      </section>
    </div>
  )
}

function LinkStatePage({ mode }) {
  const { config, handleAuthCode, signOut, updatePassword } = useAuth()
  const [state, setState] = useState({ pending: true, error: '', ready: false })

  useEffect(() => {
    let active = true
    if (!config.configured) {
      setState({ pending: false, error: 'Customer authentication is not configured.', ready: false })
      return undefined
    }
    handleAuthCode().then(() => {
      if (!active) return
      if (mode === 'callback') {
        window.location.replace(`${appPath('/my-account/')}?verified=1`)
      } else {
        setState({ pending: false, error: '', ready: true })
      }
    }).catch((caught) => {
      if (active) setState({ pending: false, error: caught.message, ready: false })
    })
    return () => { active = false }
  }, [config.configured, handleAuthCode, mode])

  async function submitPassword(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    const policyError = passwordPolicyError(password)
    if (policyError) {
      setState({ pending: false, error: policyError, ready: true })
      return
    }
    if (password !== String(form.get('confirmation'))) {
      setState({ pending: false, error: 'The password confirmation does not match.', ready: true })
      return
    }
    try {
      await updatePassword(password)
      await signOut('Your password was updated. Sign in with the new password.', 'global')
      window.location.replace(appPath('/my-account/'))
    } catch (caught) {
      setState({ pending: false, error: safeAuthError(caught), ready: true })
    }
  }

  return (
    <section className="account-state-page">
      {state.pending && <><KeyRound aria-hidden="true" /><h1>Verifying your secure link…</h1></>}
      {state.error && (
        <>
          <ShieldAlert aria-hidden="true" />
          <h1>Request a new link</h1>
          <p role="alert">{state.error}</p>
          <a href={appPath('/my-account/')}>Return to customer login</a>
        </>
      )}
      {state.ready && mode === 'reset' && (
        <>
          <CheckCircle2 aria-hidden="true" />
          <h1>Choose a new password</h1>
          <form className="account-card account-reset-form" onSubmit={submitPassword}>
            <Field label="New password" name="password" type="password" required minLength={MINIMUM_PASSWORD_LENGTH} autoComplete="new-password" />
            <Field label="Confirm password" name="confirmation" type="password" required minLength={MINIMUM_PASSWORD_LENGTH} autoComplete="new-password" />
            <button type="submit">UPDATE PASSWORD</button>
          </form>
        </>
      )}
    </section>
  )
}

export function AuthCallbackPage() {
  return <LinkStatePage mode="callback" />
}

export function ResetPasswordPage() {
  return <LinkStatePage mode="reset" />
}

export function AuthErrorPage() {
  const parameters = new URLSearchParams(window.location.search)
  const description = parameters.get('message') || 'This authentication link is invalid or has expired.'
  return (
    <section className="account-state-page">
      <ShieldAlert aria-hidden="true" />
      <h1>Account link unavailable</h1>
      <p>{description}</p>
      <a href={appPath('/my-account/')}>Request a new link</a>
    </section>
  )
}
