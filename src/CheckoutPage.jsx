import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CircleCheckBig,
  CreditCard,
  FlaskConical,
  LockKeyhole,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import './checkout.css'

const SHIPPING_RATE = 10.99
const FREE_SHIPPING_THRESHOLD = 175

const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['DC', 'District of Columbia'],
]

export function checkoutTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const savings = items.reduce((sum, item) => sum + (item.savings || 0), 0)
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_RATE
  return { subtotal, savings, shipping, total: subtotal + shipping }
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function SummaryLine({ label, value, strong = false }) {
  return (
    <div className={`checkout-total-row ${strong ? 'is-total' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function CheckoutSummary({ items, totals }) {
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - totals.subtotal)

  return (
    <aside className="checkout-summary-card" aria-label="Order summary">
      <div className="checkout-summary-heading">
        <div>
          <span className="checkout-eyebrow">Order summary</span>
          <h2>{items.reduce((sum, item) => sum + item.quantity, 0)} research items</h2>
        </div>
        <PackageCheck aria-hidden="true" />
      </div>

      <div className="checkout-summary-items">
        {items.map((item) => (
          <article className="checkout-summary-item" key={item.key}>
            <div className="checkout-summary-image">
              <img src={item.product.image} alt="" />
              <span>{item.quantity}</span>
            </div>
            <div>
              <h3>{item.product.name}</h3>
              <p>{item.option}</p>
              {item.savings > 0 && <small>You saved {money(item.savings)}</small>}
            </div>
            <strong>{money(item.total)}</strong>
          </article>
        ))}
      </div>

      {remainingForFreeShipping > 0 ? (
        <div className="shipping-progress">
          <div className="shipping-progress-copy">
            <Truck size={18} aria-hidden="true" />
            <span>Add {money(remainingForFreeShipping)} for free shipping</span>
          </div>
          <div className="shipping-progress-track" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (totals.subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%` }} />
          </div>
        </div>
      ) : (
        <div className="free-shipping-earned"><Check size={18} aria-hidden="true" /> Free priority shipping unlocked</div>
      )}

      <div className="checkout-totals">
        <SummaryLine label="Subtotal" value={money(totals.subtotal)} />
        {totals.savings > 0 && <SummaryLine label="Volume savings" value={`−${money(totals.savings)}`} />}
        <SummaryLine label="USPS Priority Mail" value={totals.shipping === 0 ? 'FREE' : money(totals.shipping)} />
        <div className="checkout-tax-note"><span>Estimated tax</span><span>Calculated after verification</span></div>
        <SummaryLine label="Estimated total" value={money(totals.total)} strong />
      </div>

      <div className="checkout-secure-note">
        <LockKeyhole size={17} aria-hidden="true" />
        <span>This preview never asks for or stores card details.</span>
      </div>
    </aside>
  )
}

export function CheckoutPage({ items, onBackToCart, onPlaceOrder, onShop }) {
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState('')
  const totals = checkoutTotals(items)

  async function submitCheckout(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }

    const values = Object.fromEntries(new FormData(form).entries())
    setPending(true)
    setStatus('Creating your preview order…')

    try {
      await onPlaceOrder({
        customer: {
          email: values.email.trim(),
          phone: values.phone.trim(),
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          company: values.company.trim(),
          address: values.address.trim(),
          address2: values.address2.trim(),
          city: values.city.trim(),
          state: values.state,
          postalCode: values.postalCode.trim(),
          country: 'United States',
        },
        totals,
      })
    } catch (error) {
      setStatus(error?.message || 'The preview order could not be created. Please try again.')
      setPending(false)
    }
  }

  if (items.length === 0) {
    return (
      <section className="checkout-empty-page">
        <ShoppingEmptyIcon />
        <span className="checkout-eyebrow">Checkout</span>
        <h1>Your cart is empty</h1>
        <p>Add a research product before starting checkout.</p>
        <button type="button" onClick={onShop}>RETURN TO SHOP</button>
      </section>
    )
  }

  return (
    <div className="checkout-page">
      <header className="checkout-hero">
        <div className="checkout-hero-inner">
          <button className="checkout-back" type="button" onClick={onBackToCart}>
            <ArrowLeft size={18} aria-hidden="true" /> Back to cart
          </button>
          <span className="checkout-eyebrow">Secure research checkout</span>
          <h1>Complete your order</h1>
          <p>US domestic shipping only. Buyer qualification is reviewed before fulfillment.</p>
          <ol className="checkout-steps" aria-label="Checkout progress">
            <li className="is-active"><span>1</span> Contact</li>
            <li className="is-active"><span>2</span> Delivery</li>
            <li className="is-active"><span>3</span> Review</li>
          </ol>
        </div>
      </header>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submitCheckout} noValidate>
          <div className="checkout-preview-banner" role="note">
            <FlaskConical aria-hidden="true" />
            <div>
              <strong>Local checkout preview</strong>
              <span>This completes the UI flow only. No payment, fulfillment, or confirmation email is created.</span>
            </div>
          </div>

          <fieldset className="checkout-section">
            <legend><span>1</span> Contact information</legend>
            <p>We’ll use these details for the preview receipt.</p>
            <div className="checkout-field-grid">
              <label className="checkout-field is-wide">
                <span>Email address *</span>
                <input name="email" type="email" autoComplete="email" placeholder="researcher@example.com" required />
              </label>
              <label className="checkout-field is-wide">
                <span>Phone number *</span>
                <input name="phone" type="tel" autoComplete="tel" placeholder="(555) 555-0147" minLength="7" required />
              </label>
            </div>
          </fieldset>

          <fieldset className="checkout-section">
            <legend><span>2</span> Shipping address</legend>
            <p>Orders can currently be shipped only within the United States.</p>
            <div className="checkout-field-grid">
              <label className="checkout-field">
                <span>First name *</span>
                <input name="firstName" autoComplete="given-name" required />
              </label>
              <label className="checkout-field">
                <span>Last name *</span>
                <input name="lastName" autoComplete="family-name" required />
              </label>
              <label className="checkout-field is-wide">
                <span>Company or institution</span>
                <input name="company" autoComplete="organization" />
              </label>
              <label className="checkout-field is-wide">
                <span>Street address *</span>
                <input name="address" autoComplete="address-line1" required />
              </label>
              <label className="checkout-field is-wide">
                <span>Apartment, suite, unit, etc.</span>
                <input name="address2" autoComplete="address-line2" />
              </label>
              <label className="checkout-field is-wide">
                <span>City *</span>
                <input name="city" autoComplete="address-level2" required />
              </label>
              <label className="checkout-field">
                <span>State *</span>
                <select name="state" autoComplete="address-level1" defaultValue="" required>
                  <option value="" disabled>Select state</option>
                  {US_STATES.map(([code, name]) => <option value={code} key={code}>{name}</option>)}
                </select>
              </label>
              <label className="checkout-field">
                <span>ZIP code *</span>
                <input name="postalCode" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" placeholder="12345" required />
              </label>
              <div className="checkout-field is-wide">
                <span>Country</span>
                <div className="checkout-static-field"><MapPin size={17} aria-hidden="true" /> United States</div>
              </div>
            </div>
          </fieldset>

          <fieldset className="checkout-section">
            <legend><span>3</span> Shipping & payment</legend>
            <div className="shipping-method is-selected">
              <div className="shipping-radio" aria-hidden="true"><span /></div>
              <Truck aria-hidden="true" />
              <div>
                <strong>USPS Priority Mail</strong>
                <span>Estimated 2–3 business days after processing</span>
              </div>
              <strong>{totals.shipping === 0 ? 'FREE' : money(totals.shipping)}</strong>
            </div>

            <div className="checkout-payment-preview">
              <CreditCard aria-hidden="true" />
              <div>
                <strong>Preview payment</strong>
                <span>No card number is requested and no charge will be attempted.</span>
              </div>
              <img src="/assets/payment-methods.png" alt="Supported payment methods in a connected production checkout" />
            </div>

            <label className="checkout-agreement">
              <input name="researchAgreement" type="checkbox" required />
              <span>
                I confirm that I am at least 21 years old, am qualified to purchase these materials,
                and will use all products solely for in vitro laboratory research—not for human or veterinary use. *
              </span>
            </label>
          </fieldset>

          <button className="checkout-submit" type="submit" disabled={pending}>
            {pending ? 'CREATING PREVIEW ORDER…' : `PLACE PREVIEW ORDER • ${money(totals.total)}`}
          </button>
          {status && <p className="checkout-status" role="status">{status}</p>}
          <p className="checkout-submit-note"><ShieldCheck size={17} aria-hidden="true" /> No real transaction is created in this local preview.</p>
        </form>

        <CheckoutSummary items={items} totals={totals} />
      </div>
    </div>
  )
}

function ShoppingEmptyIcon() {
  return <PackageCheck size={58} strokeWidth={1.3} aria-hidden="true" />
}

export function OrderConfirmationPage({ order, onShop }) {
  const sessionId = new URLSearchParams(window.location.search).get('session_id')
  const [liveOrder, setLiveOrder] = useState(null)
  const [liveStatus, setLiveStatus] = useState(sessionId ? 'Verifying your payment…' : '')

  useEffect(() => {
    if (!sessionId) return undefined
    const controller = new AbortController()
    let retryTimer
    async function loadOrder(attempt = 0) {
      try {
        const response = await fetch(`/api/orders/status?session_id=${encodeURIComponent(sessionId)}`, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          signal: controller.signal,
        })
        const data = await response.json()
        if (response.status === 202 && attempt < 30) {
          retryTimer = window.setTimeout(() => loadOrder(attempt + 1), 1500)
          return
        }
        if (!response.ok) throw new Error(data.message || 'Order verification failed.')
        setLiveOrder(data)
        setLiveStatus('')
      } catch (error) {
        if (error.name !== 'AbortError') setLiveStatus(error.message || 'Order verification failed. Please contact support.')
      }
    }
    loadOrder()
    return () => {
      controller.abort()
      window.clearTimeout(retryTimer)
    }
  }, [sessionId])

  if (sessionId && !liveOrder) {
    return (
      <section className="order-confirmation-page">
        <div className="order-confirmation-card">
          <ShieldCheck aria-hidden="true" />
          <span className="checkout-eyebrow">Secure payment verification</span>
          <h1>{liveStatus}</h1>
          <p>Do not close this page while the server confirms the Stripe Checkout session.</p>
        </div>
      </section>
    )
  }

  if (liveOrder) {
    const total = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: liveOrder.currency?.toUpperCase() || 'USD',
    }).format(liveOrder.totalCents / 100)
    return (
      <section className="order-confirmation-page">
        <div className="order-confirmation-card">
          <div className="order-confirmation-icon"><CircleCheckBig aria-hidden="true" /></div>
          <span className="checkout-eyebrow">Payment verified</span>
          <h1>Thank you for your order.</h1>
          <p>Your payment was verified by Stripe on the server. Fulfillment can now proceed.</p>
          <div className="order-confirmation-number">
            <span>Order number</span>
            <strong>{liveOrder.orderNumber}</strong>
            <small>Total paid: {total}</small>
          </div>
          <button type="button" onClick={onShop}>CONTINUE SHOPPING</button>
        </div>
      </section>
    )
  }

  if (!order) {
    return (
      <section className="checkout-empty-page">
        <ShoppingEmptyIcon />
        <span className="checkout-eyebrow">Preview receipt</span>
        <h1>No preview order found</h1>
        <p>Preview receipts are available only in the browser tab where checkout was completed.</p>
        <button type="button" onClick={onShop}>RETURN TO SHOP</button>
      </section>
    )
  }

  return (
    <section className="order-confirmation-page">
      <div className="order-confirmation-card">
        <div className="order-confirmation-icon"><CircleCheckBig aria-hidden="true" /></div>
        <span className="checkout-eyebrow">Preview order complete</span>
        <h1>Thanks, {order.customer.firstName}.</h1>
        <p>Your checkout flow completed successfully. This is a local preview receipt—not a paid or fulfillable order.</p>

        <div className="order-confirmation-number">
          <span>Preview reference</span>
          <strong>{order.id}</strong>
          <small>{order.placedAtLabel}</small>
        </div>

        <div className="order-confirmation-grid">
          <div>
            <span className="order-confirmation-label">Contact</span>
            <strong>{order.customer.email}</strong>
            <span>{order.customer.phone}</span>
          </div>
          <div>
            <span className="order-confirmation-label">Ship to</span>
            <strong>{order.customer.firstName} {order.customer.lastName}</strong>
            <span>{order.customer.city}, {order.customer.state} {order.customer.postalCode}</span>
          </div>
        </div>

        <div className="order-confirmation-lines">
          {order.items.map((item) => (
            <div key={item.key}>
              <span>{item.quantity} × {item.name} <small>{item.option}</small></span>
              <strong>{money(item.total)}</strong>
            </div>
          ))}
          <div><span>Shipping</span><strong>{order.totals.shipping === 0 ? 'FREE' : money(order.totals.shipping)}</strong></div>
          <div className="is-total"><span>Estimated total</span><strong>{money(order.totals.total)}</strong></div>
        </div>

        <div className="order-confirmation-warning">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>No payment was processed</strong>
            <span>Connect the approved hosted checkout service before accepting real customer orders.</span>
          </div>
        </div>

        <button type="button" onClick={onShop}>CONTINUE SHOPPING</button>
      </div>
    </section>
  )
}
