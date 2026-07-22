import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ClipboardList,
  Info,
  Mail,
  Menu,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  TestTube2,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import Catalog from './Catalog.jsx'
import ShopPage from './ShopPage.jsx'
import { AboutPage, ElitePage, NewsPage, ResearchAreasPage } from './AboutPages.jsx'
import { AccountPage, ContactPage, FaqPage, TrackOrderPage } from './SupportPages.jsx'
import { CoaProcessPage, DilutionGuidePage, ManufacturingPage, ProductInfoPage } from './PeptideInfoPages.jsx'
import { CoaCategoryPage, CoaLibraryPage } from './CoaLibraryPages.jsx'
import { CheckoutPage, OrderConfirmationPage } from './CheckoutPage.jsx'
import PolicyPage from './PolicyPages.jsx'
import productDetailManifest from './productDetailManifest.json'
import { catalogVersion } from './catalog.js'
import routeMetadata from './routeMetadata.json'
import { isProductPath, productFromPath, productPath, productSlug } from './productRoutes.js'
import { appPath, canonicalPath } from './appPath.js'
import { postToSiteService, safeServiceMessage, siteServices } from './siteServices.js'
import useDialogFocus from './useDialogFocus.js'

function createProductDetailRoute(loadDetails) {
  return lazy(async () => {
    const [{ ProductDetailPage }, { default: details }] = await Promise.all([
      import('./ProductDetailPage.jsx'),
      loadDetails(),
    ])

    function ProductDetailRoute(props) {
      return <ProductDetailPage {...props} detail={details[props.product.detailKey || productSlug(props.product)] || null} />
    }

    return { default: ProductDetailRoute }
  })
}

const productDetailRoutes = {
  vials: createProductDetailRoute(() => import('./productDetailData/vials.json')),
  capsules: createProductDetailRoute(() => import('./productDetailData/capsules.json')),
  liquids: createProductDetailRoute(() => import('./productDetailData/liquids.json')),
  topicals: createProductDetailRoute(() => import('./productDetailData/topicals.json')),
}

const ProductNotFoundPage = lazy(() => import('./ProductDetailPage.jsx').then((module) => ({
  default: module.ProductNotFoundPage,
})))

function productDocumentTitle(product) {
  return productDetailManifest[productSlug(product)] || `${product?.name || 'Product'} - Pure Health Peptides`
}

const CART_STORAGE_KEY = 'php-research-cart-v1'
const PREVIEW_ORDER_STORAGE_KEY = 'php-research-preview-order-v1'
let researchConfirmedForSession = false

function hasResearchConfirmation() {
  if (researchConfirmedForSession) return true
  try {
    return localStorage.getItem('php-research-confirmed') === 'true'
  } catch {
    return false
  }
}

function storeResearchConfirmation() {
  researchConfirmedForSession = true
  try {
    localStorage.setItem('php-research-confirmed', 'true')
  } catch {
    // The gate remains valid for this session if storage is unavailable.
  }
}

function readStoredCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []

    return parsed.slice(0, 50).flatMap((item) => {
      const unitPrice = Number.parseFloat(item?.unitPrice)
      const requestedMax = Number.parseInt(item?.maxQty, 10)
      const maxQty = Number.isFinite(requestedMax) && requestedMax > 0 ? Math.min(requestedMax, 1000) : 1000
      const requestedQuantity = Number.parseInt(item?.quantity, 10)
      const quantity = Math.min(maxQty, Math.max(1, Number.isFinite(requestedQuantity) ? requestedQuantity : 1))
      const product = item?.product
      const valid = typeof item?.key === 'string'
        && item.key.length <= 180
        && typeof item?.option === 'string'
        && typeof item?.variantId === 'string'
        && item.option.length <= 120
        && Number.isFinite(unitPrice)
        && unitPrice >= 0
        && product
        && typeof product.id === 'string'
        && typeof product.name === 'string'
        && typeof product.image === 'string'
        && product.image.startsWith('/assets/shop/')

      if (!valid) return []
      return [{
        ...item,
        product,
        quantity,
        unitPrice,
        maxQty,
        ...calculateLinePricing(product, unitPrice, quantity),
      }]
    })
  } catch {
    return []
  }
}

function readStoredPreviewOrder() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(PREVIEW_ORDER_STORAGE_KEY) || 'null')
    return parsed?.id && Array.isArray(parsed?.items) ? parsed : null
  } catch {
    return null
  }
}

function createPreviewOrderId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const random = new Uint32Array(1)
  crypto.getRandomValues(random)
  return `PREVIEW-${date}-${String(random[0] % 100000).padStart(5, '0')}`
}

function updateMeta(selector, attributes) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement(selector.startsWith('link') ? 'link' : 'meta')
    document.head.append(element)
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value))
}

function updateStructuredData(schema) {
  let script = document.head.querySelector('#seo-jsonld')
  if (!schema) {
    script?.remove()
    return
  }
  if (!script) {
    script = document.createElement('script')
    script.id = 'seo-jsonld'
    script.type = 'application/ld+json'
    document.head.append(script)
  }
  script.textContent = JSON.stringify(schema).replaceAll('<', '\\u003c')
}

const routePaths = Object.fromEntries(Object.entries({
  home: '/',
  shop: '/shop/',
  about: '/about-us/',
  research: '/research-areas/',
  news: '/news/',
  elite: '/pure-elite-access/',
  account: '/my-account/',
  track: '/track-my-order/',
  faqs: '/faqs/',
  contact: '/contact-us/',
  productInfo: '/info-cards/',
  testing: '/coa-process/',
  manufacturing: '/manufacturing/',
  dilution: '/dilution-guide/',
  coaLibrary: '/coa-library/',
  coaVials: '/coa-library/vials/',
  coaCapsules: '/coa-library/capsules/',
  coaLiquids: '/coa-library/liquids/',
  coaTopicals: '/coa-library/topicals/',
  checkout: '/checkout/',
  orderConfirmation: '/order-confirmation/',
  shippingPolicy: '/shipping-policy/',
  refundPolicy: '/refund-policy/',
  privacyPolicy: '/privacy-policy/',
  terms: '/terms-and-conditions/',
}).map(([route, path]) => [route, appPath(path)]))

const navRouteByLabel = {
  'Why Us?': 'about',
  'Research Areas': 'research',
  News: 'news',
  'Pure Elite Access': 'elite',
  'My Account': 'account',
  'My account': 'account',
  'Track My Order': 'track',
  FAQs: 'faqs',
  Contact: 'contact',
  'Product Info': 'productInfo',
  'COA Process': 'testing',
  'Testing Process': 'testing',
  Manufacturing: 'manufacturing',
  'Dilution Guide': 'dilution',
  'COA Library': 'coaLibrary',
  Vials: 'coaVials',
  Capsules: 'coaCapsules',
  Liquids: 'coaLiquids',
  Topicals: 'coaTopicals',
  'Shipping Policy': 'shippingPolicy',
  'Refund Policy': 'refundPolicy',
  'Privacy Policy': 'privacyPolicy',
  'Terms and Conditions': 'terms',
}

const navGroups = [
  {
    label: 'About',
    links: ['Why Us?', 'Research Areas', 'News', 'Pure Elite Access'],
  },
  {
    label: 'Support',
    links: ['My Account', 'Track My Order', 'FAQs', 'Contact'],
  },
  {
    label: 'Peptide Info',
    links: ['Product Info', 'COA Process', 'Manufacturing', 'Dilution Guide'],
  },
  {
    label: 'COA Library',
    links: ['Vials', 'Capsules', 'Liquids', 'Topicals'],
  },
]

const researchBenefits = [
  {
    title: '99% Purity',
    copy: 'Independently tested for purity and identity',
    icon: ShieldCheck,
  },
  {
    title: 'COA Every Batch',
    copy: 'Searchable Certificates of Analysis online',
    icon: ClipboardList,
  },
  {
    title: 'Fast U.S. Shipping',
    copy: 'Quick, discrete, and reliable delivery',
    icon: Truck,
  },
  {
    title: 'Independently Batch Tested in U.S.A.',
    copy: 'Visit our COA library',
    icon: TestTube2,
  },
]

function Header({ onMenu, onSearch, onCart, onHome, onShop, onNavigate, cartCount }) {
  return (
    <>
      <div className="announcement">
        FREE SHIPPING ON ORDERS $175+ (EXCL. DISCOUNTS, FEES AND TAXES)
      </div>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="/"
            aria-label="Pure Health Peptides home"
            onClick={(event) => { event.preventDefault(); onHome() }}
          >
            <img src="/assets/logo.svg" alt="Pure Health Peptides" />
          </a>

          <nav className="desktop-nav" aria-label="Primary navigation">
            <a
              className="nav-link"
              href={routePaths.shop}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                onShop()
              }}
            >SHOP</a>
            {navGroups.map((group) => (
              <div className="nav-group" key={group.label}>
                <button
                  className="nav-link nav-link-with-icon"
                  type="button"
                  onClick={group.label === 'COA Library' ? () => onNavigate('coaLibrary') : undefined}
                >
                  {group.label}
                  <ChevronDown size={14} strokeWidth={1.6} />
                </button>
                <div className="nav-dropdown">
                  {group.links.map((link) => {
                    const nextRoute = navRouteByLabel[link]
                    return (
                      <a
                        href={nextRoute ? routePaths[nextRoute] : '#catalog'}
                        key={link}
                        onClick={nextRoute ? (event) => { event.preventDefault(); onNavigate(nextRoute) } : undefined}
                      >
                        {link}
                      </a>
                    )
                  })}
                </div>
              </div>
            ))}
            <a
              className="sale-pill"
              href={routePaths.shop}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                onShop()
              }}
            >
              Peptides FOR SALE
            </a>
          </nav>

          <div className="header-actions">
            <button type="button" aria-label="My account" onClick={() => onNavigate('account')}>
              <UserRound />
            </button>
            <button className="cart-action" type="button" aria-label="Open cart" onClick={onCart}>
              <ShoppingBag />
              <span>{cartCount}</span>
            </button>
            <button type="button" aria-label="Search" onClick={onSearch}>
              <Search />
            </button>
            <button className="menu-action" type="button" aria-label="Open menu" onClick={onMenu}>
              <Menu />
            </button>
          </div>
        </div>
      </header>
    </>
  )
}

function MobileMenu({ open, onClose, onShop, onNavigate }) {
  const [expanded, setExpanded] = useState('')
  const dialogRef = useDialogFocus(open, onClose)

  useEffect(() => {
    if (!open) setExpanded('')
  }, [open])

  return (
    <div className={`drawer-layer ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button className="drawer-backdrop" type="button" aria-label="Close menu" onClick={onClose} />
      <aside ref={dialogRef} className="menu-drawer" role="dialog" aria-modal="true" aria-label="Site menu" tabIndex="-1">
        <div className="drawer-heading">
          <img src="/assets/logo.svg" alt="Pure Health Peptides" />
          <button type="button" aria-label="Close menu" onClick={onClose}><X /></button>
        </div>
        <a
          className="mobile-shop"
          href={routePaths.shop}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            onClose()
            onShop()
          }}
        >
          SHOP PEPTIDES
        </a>
        {navGroups.map((group) => {
          const active = expanded === group.label
          return (
            <div className="mobile-nav-group" key={group.label}>
              <button
                type="button"
                aria-expanded={active}
                onClick={() => setExpanded(active ? '' : group.label)}
              >
                {group.label}
                <ChevronDown className={active ? 'rotate' : ''} size={18} />
              </button>
              <div className={`mobile-nav-links ${active ? 'expanded' : ''}`}>
                {group.label === 'COA Library' && (
                  <a
                    href={routePaths.coaLibrary}
                    onClick={(event) => { event.preventDefault(); onNavigate('coaLibrary') }}
                  >
                    COA Library
                  </a>
                )}
                {group.links.map((link) => {
                  const nextRoute = navRouteByLabel[link]
                  return (
                    <a
                      href={nextRoute ? routePaths[nextRoute] : '#catalog'}
                      onClick={(event) => {
                        if (nextRoute) {
                          event.preventDefault()
                          onNavigate(nextRoute)
                        } else {
                          onClose()
                        }
                      }}
                      key={link}
                    >
                      {link}
                    </a>
                  )
                })}
              </div>
            </div>
          )
        })}
      </aside>
    </div>
  )
}

function SearchPanel({ open, onClose, onSubmitSearch }) {
  const inputId = useId()
  const inputRef = useRef(null)
  const dialogRef = useDialogFocus(open, onClose, { initialFocusRef: inputRef })

  function submit(event) {
    event.preventDefault()
    const query = new FormData(event.currentTarget).get('search')?.toString().trim() || ''
    onClose()
    onSubmitSearch(query)
  }

  return (
    <div className={`search-panel ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <div ref={dialogRef} className="search-panel-inner" role="dialog" aria-modal="true" aria-label="Search the research catalog" tabIndex="-1">
        <label htmlFor={inputId}>Search the research catalog</label>
        <form onSubmit={submit}>
          <input ref={inputRef} id={inputId} name="search" type="search" placeholder="Search peptides..." autoComplete="off" />
          <button type="submit" aria-label="Submit search"><Search /></button>
        </form>
        <button className="search-close" type="button" aria-label="Close search" onClick={onClose}><X /></button>
      </div>
    </div>
  )
}

function CartDrawer({ open, onClose, onShop, items, onRemove, onChangeQuantity, onCheckout, onPreviewCheckout, checkoutConfigured }) {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const [checkoutStatus, setCheckoutStatus] = useState('')
  const [checkoutPending, setCheckoutPending] = useState(false)
  const dialogRef = useDialogFocus(open, onClose)

  async function checkout() {
    if (!checkoutConfigured) {
      onPreviewCheckout()
      return
    }
    setCheckoutPending(true)
    setCheckoutStatus('Preparing secure checkout…')
    try {
      await onCheckout(items)
    } catch (error) {
      setCheckoutStatus(safeServiceMessage(error, 'Checkout could not be started. Please try again.'))
      setCheckoutPending(false)
    }
  }

  return (
    <div className={`drawer-layer ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button className="drawer-backdrop" type="button" aria-label="Close cart" onClick={onClose} />
      <aside ref={dialogRef} className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" tabIndex="-1">
        <div className="drawer-heading">
          <h2 id="cart-title">Your Cart</h2>
          <button type="button" aria-label="Close cart" onClick={onClose}><X /></button>
        </div>
        {items.length === 0 ? (
          <div className="cart-empty">
            <ShoppingBag size={46} strokeWidth={1.3} />
            <p>Your cart is empty</p>
            <button type="button" onClick={onShop}>RETURN TO SHOP</button>
          </div>
        ) : (
          <div className="cart-contents">
            <div className="cart-lines">
              {items.map((item) => (
                <article className="cart-line" key={item.key}>
                  <img src={item.product.image} alt="" />
                  <div>
                    <h3>{item.product.name}</h3>
                    <p>{item.option}</p>
                    <div className="cart-line-actions">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.product.name} quantity`}
                        disabled={item.quantity <= 1}
                        onClick={() => onChangeQuantity(item.key, item.quantity - 1)}
                      >−</button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.product.name} quantity`}
                        disabled={item.quantity >= item.maxQty}
                        onClick={() => onChangeQuantity(item.key, item.quantity + 1)}
                      >+</button>
                      <strong>${item.total.toFixed(2)}</strong>
                    </div>
                    <button className="cart-remove" type="button" onClick={() => onRemove(item.key)}>Remove</button>
                  </div>
                </article>
              ))}
            </div>
            <div className="cart-summary">
              <p><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></p>
              <small>Shipping and taxes calculated at checkout.</small>
              <button className="cart-checkout" type="button" disabled={checkoutPending} onClick={checkout}>
                {checkoutPending ? 'PREPARING CHECKOUT…' : 'CHECKOUT'}
              </button>
              {!checkoutConfigured && <span className="cart-service-status">Local preview checkout available. No payment will be processed.</span>}
              {checkoutStatus && <span className="cart-service-status" role="status">{checkoutStatus}</span>}
              <button className="cart-continue" type="button" onClick={onShop}>CONTINUE SHOPPING</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function ResearchGate({ open, onClose, onConfirm, onLeave }) {
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const confirmationInput = useRef(null)
  const dialogRef = useDialogFocus(open, onClose, { initialFocusRef: confirmationInput, closeOnEscape: false })

  useEffect(() => {
    if (!open) {
      setConfirmed(false)
      setError('')
    }
  }, [open])

  function enter() {
    if (!confirmed) {
      setError('You must be 21 or older to access this site.')
      return
    }
    storeResearchConfirmation()
    onConfirm?.()
    onClose()
  }

  if (!open) return null

  return (
    <div className="gate-overlay">
      <div ref={dialogRef} className="research-gate" role="dialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-copy" tabIndex="-1">
        <span className="eyebrow">WELCOME TO</span>
        <h2 id="gate-title">Pure Health Peptides</h2>
        <p id="gate-copy">
          All products sold by Pure Health Peptides LLC are intended for laboratory and research
          purposes only. They are not for human consumption, veterinary use, or medical applications.
          You must be 21 years or older to purchase. Misuse of these products is strictly prohibited.
        </p>
        <label className="gate-check">
          <input
            ref={confirmationInput}
            type="checkbox"
            checked={confirmed}
            onChange={(event) => { setConfirmed(event.target.checked); setError('') }}
          />
          <span className="custom-check"><Check size={15} /></span>
          <span>
            I confirm I am 21 or older and agree to the Terms &amp; Conditions, Privacy Policy and
            that all products are for research use only.
          </span>
        </label>
        {error && <p className="gate-error" role="alert">{error}</p>}
        <div className="gate-actions">
          <button className="button button-primary" type="button" onClick={enter}>
            Yes, I’m 21 and above
          </button>
          <button className="button button-outline" type="button" onClick={onLeave}>
            Leave site
          </button>
        </div>
      </div>
    </div>
  )
}

function Hero({ onGate }) {
  return (
    <section className="hero" id="home">
      <div className="hero-inner">
        <div className="hero-main">
          <div className="hero-copy">
            <p className="eyebrow eyebrow-light">PURE HEALTH PEPTIDES</p>
            <h1>
              <span>ReSeARCH PePTIDeS</span>
              <strong>YOU CAN TRUST.</strong>
            </h1>
            <p className="hero-description">
              Every batch is independently tested in the USA, documented, and backed by transparent
              Certificates of Analysis so researchers can purchase with confidence.
            </p>
            <div className="hero-buttons">
              <a
                className="button button-primary"
                href={routePaths.shop}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  onGate()
                }}
              >SHOP PEPTIDES</a>
              <a className="button button-light" href="#transparency">VERIFY A COA</a>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <img src="/assets/hero-vials.png" alt="" />
          </div>
        </div>

        <div className="benefit-grid">
          {researchBenefits.map(({ title, copy, icon: Icon }) => (
            <article className="benefit-card" key={title}>
              <Icon aria-hidden="true" />
              <div>
                <h2>{title}</h2>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function TopicalEvent({ onGate }) {
  return (
    <section className="topical-event">
      <div className="topical-inner">
        <div className="topical-product">
          <img src="/assets/topical-event.png" alt="Pure Health Peptides topical discovery collection" />
        </div>
        <div className="topical-copy">
          <p className="eyebrow">INTRODUCING</p>
          <h2>PHP — TOPICAL DISCOVeRY eVeNT</h2>
          <p className="event-offer">
            For a limited period — <strong>Receive your Complimentary PHP Discovery Collection</strong>
            {' '}with qualifying research orders of <strong>$500 or more*</strong>
          </p>
          <small>*after discount, before fees and taxes</small>
          <img
            className="topical-mobile-product"
            src="/assets/topical-event.png"
            alt="Pure Health Peptides topical discovery collection"
          />
          <button className="topical-link" type="button" onClick={onGate}>
            Discover the PHP Topical Format System.
          </button>
          <p>Our uniquely architected topical research platform, designed exclusively by Pure Health Peptides.</p>
        </div>
      </div>
    </section>
  )
}

function Welcome() {
  return (
    <section className="welcome section-pad">
      <div className="section-inner welcome-grid">
        <div className="welcome-copy">
          <p className="eyebrow">WELCOME TO</p>
          <h2>Pure Health Peptides</h2>
          <p><strong>Where Science Meets Excellence—and Research Has No Limits.</strong></p>
          <p>
            Your research deserves more than the ordinary. It deserves the best. At Pure Health
            Peptides, we don’t just supply peptides—we deliver game-changing quality, unbeatable
            pricing, and world-class service to fuel the breakthroughs of tomorrow.
          </p>
          <p>
            Tired of me-too suppliers? We’re not like them. With 99%+ purity guaranteed,
            industry-leading compliance, and a customer-first approach, we’re setting a new benchmark
            for peptide excellence. Every peptide, every vial, every time—precision you can trust,
            prices you can count on, and service that stands out.
          </p>
          <p>
            This is where serious researchers come to win. Step into the future of science with Pure
            Health Peptides—the partner you’ve been waiting for.
          </p>
        </div>
        <aside className="usage-card">
          <Info aria-hidden="true" />
          <div>
            <h3>Product Usage: For Research Use Only</h3>
            <h4>Not for Human or Veterinary Use</h4>
            <p>
              Pure Health Peptides products are supplied to qualified research professionals and
              institutional users for in vitro laboratory research only. KYC verification is required
              prior to order fulfillment, and we reserve the right to refuse orders that do not meet
              buyer qualification criteria. These products are not drugs, foods, cosmetics, or dietary
              supplements, have not been evaluated by the FDA, and are not intended for human or animal
              use. Any such use is prohibited and may violate federal, state, or local law. By purchasing,
              the buyer represents and warrants that the product will be used solely for in vitro research.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

function DiscountSection({ onGate }) {
  return (
    <section className="discount-section">
      <div className="section-inner discount-grid">
        <div className="discount-column">
          <p className="eyebrow eyebrow-light">ORDER MORE, SAVE MORE</p>
          <h2>DISCOUNT STRUCTURe</h2>
          <h3>Unlock Exclusive Savings with Our Unique Discount Structure!</h3>
          <p>Why settle for less when you can save more—every time?</p>
          <p>
            At Pure Health Peptides, we reward your commitment to groundbreaking research with a
            straightforward, unbeatable discount structure:
          </p>
          <p><strong>The number of vials you order per product = Your Discount!</strong></p>
          <ul>
            <li>2 vials = 2% off</li>
            <li>5 vials = 5% off</li>
            <li>10 vials = 10% off</li>
            <li>Up to a massive 15% off for 15+ vials of the same product!</li>
          </ul>
        </div>
        <div className="discount-column freebies">
          <p className="eyebrow eyebrow-light">FREEBIES FOR</p>
          <h2>Researchers Who Go Big</h2>
          <ul>
            <li><strong>Orders over $75:</strong> Receive a FREE Vial Vault, our sleek, secure container to store your research vials.</li>
            <li><strong>Orders over $175:</strong> Free Shipping on your entire order—no hassle, no hidden fees.</li>
          </ul>
          <button className="button button-primary" type="button" onClick={onGate}>SHOP NOW</button>
        </div>
      </div>
    </section>
  )
}

function Transparency({ onNavigate }) {
  return (
    <section className="transparency section-pad" id="transparency">
      <div className="section-inner transparency-grid">
        <div className="coa-visual">
          <img src="/assets/coa-documents.png" alt="Pure Health Peptides certificates of analysis" />
        </div>
        <div className="transparency-copy">
          <p className="eyebrow">PURE SCIENCE</p>
          <h2>TRANSPARENT RESULTS</h2>
          <p>
            At Pure Health Peptides, we are committed to providing the clarity and confidence researchers
            need. Every batch of our peptides undergoes rigorous third-party testing in the USA, with
            detailed Certificates of Analysis (COAs) available for verification. We invite you to visit
            our Certifications page, where you can <strong>easily search for your batch number and access
            its COA.</strong> This commitment to transparency ensures you have the data you need to trust
            our products and focus on advancing your research.
          </p>
          <a
            className="button button-outline-blue"
            href={routePaths.coaLibrary}
            onClick={(event) => { event.preventDefault(); onNavigate('coaLibrary') }}
          >EXPLORE CERTIFICATIONS</a>
        </div>
      </div>
    </section>
  )
}

function Newsletter() {
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState('')

  async function subscribe(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    if (!siteServices.newsletterEndpoint) {
      setStatus('Newsletter sign-up is not connected on this deployment. Email info@purehealthpeptides.com for updates.')
      return
    }

    const form = event.currentTarget
    const email = new FormData(form).get('email')?.toString().trim()
    setStatus('Submitting…')
    try {
      await postToSiteService(siteServices.newsletterEndpoint, { email })
      form.reset()
      setStatus('')
      setSubmitted(true)
    } catch (error) {
      setStatus(safeServiceMessage(error, 'Newsletter sign-up failed. Please try again.'))
    }
  }

  return (
    <section className="newsletter-section">
      <div className="newsletter-card">
        <div>
          <h2>SUBSCRIBE TO NEWSLETTER</h2>
          <p>Be the first to know about new products &amp; special offers from Pure Health Peptides!</p>
        </div>
        {submitted ? (
          <div className="newsletter-success" role="status">
            <Check size={20} /> Check your inbox to confirm your subscription.
          </div>
        ) : (
          <form onSubmit={subscribe}>
            <label className="sr-only" htmlFor="newsletter-email">Email address</label>
            <input id="newsletter-email" name="email" type="email" placeholder="Email Address *" required />
            <button type="submit">Submit</button>
            {status && <span className="newsletter-form-status" role="status">{status}</span>}
          </form>
        )}
      </div>
    </section>
  )
}

const footerGroups = {
  about: ['Why Us?', 'Research Areas', 'News', 'Pure Elite Access'],
  support: ['My account', 'Track My Order', 'FAQs', 'Contact'],
  peptide: ['Product Info', 'Testing Process', 'Dilution Guide'],
  coa: ['Vials', 'Capsules', 'Liquids', 'Topicals'],
  legal: ['Shipping Policy', 'Refund Policy', 'Privacy Policy', 'Terms and Conditions', 'Disclaimer', 'Waiver Agreement'],
}

const footerLegalUrls = {
  Disclaimer: 'https://purehealthpeptides.com/disclaimer/',
  'Waiver Agreement': 'https://purehealthpeptides.com/waiver-agreement-policy/',
}

function FooterLink({ children, onNavigate }) {
  const route = navRouteByLabel[children]
  const href = route ? routePaths[route] : footerLegalUrls[children]

  return (
    <a
      href={href}
      onClick={route ? (event) => { event.preventDefault(); onNavigate(route) } : undefined}
    >
      {children}
    </a>
  )
}

function FooterAccordion({ title, links, onNavigate }) {
  return (
    <details className="footer-mobile-accordion">
      <summary>
        <span>{title}</span>
        <ChevronDown aria-hidden="true" size={14} strokeWidth={2} />
      </summary>
      <div className="footer-mobile-accordion-links">
        {links.map((link) => <FooterLink key={link} onNavigate={onNavigate}>{link}</FooterLink>)}
      </div>
    </details>
  )
}

function Footer({ onNavigate }) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <a
          className="footer-logo-link"
          href="/"
          aria-label="Pure Health Peptides home"
          onClick={(event) => { event.preventDefault(); onNavigate('home') }}
        >
          <img className="footer-logo" src="/assets/footer-logo.svg" alt="Pure Health Peptides" />
        </a>

        <nav className="footer-navigation-desktop" aria-label="Footer navigation">
          <div className="footer-column">
            <a className="footer-column-heading" href="/" onClick={(event) => { event.preventDefault(); onNavigate('home') }}>Home</a>
            <h2>Peptide Info</h2>
            {footerGroups.peptide.map((link) => <FooterLink key={link} onNavigate={onNavigate}>{link}</FooterLink>)}
            <h2 className="footer-column-section">Legal</h2>
            {footerGroups.legal.map((link) => <FooterLink key={link} onNavigate={onNavigate}>{link}</FooterLink>)}
          </div>
          <div className="footer-column">
            <a className="footer-column-heading" href="/shop/" onClick={(event) => { event.preventDefault(); onNavigate('shop') }}>Shop</a>
            <h2>COA Library</h2>
            {footerGroups.coa.map((link) => <FooterLink key={link} onNavigate={onNavigate}>{link}</FooterLink>)}
            <h2 className="footer-column-section">Support</h2>
            {footerGroups.support.map((link) => <FooterLink key={link} onNavigate={onNavigate}>{link}</FooterLink>)}
          </div>
          <div className="footer-column">
            <h2 className="footer-column-heading">About</h2>
            {footerGroups.about.map((link) => <FooterLink key={link} onNavigate={onNavigate}>{link}</FooterLink>)}
          </div>
        </nav>

        <nav className="footer-navigation-mobile" aria-label="Footer navigation">
          <a className="footer-mobile-direct" href="/" onClick={(event) => { event.preventDefault(); onNavigate('home') }}>Home</a>
          <a className="footer-mobile-direct footer-mobile-shop" href="/shop/" onClick={(event) => { event.preventDefault(); onNavigate('shop') }}>Shop</a>
          <FooterAccordion title="About" links={footerGroups.about} onNavigate={onNavigate} />
          <FooterAccordion title="Support" links={footerGroups.support} onNavigate={onNavigate} />
          <FooterAccordion title="Peptide Info" links={footerGroups.peptide} onNavigate={onNavigate} />
          <FooterAccordion title="Legal" links={footerGroups.legal} onNavigate={onNavigate} />
        </nav>

        <div className="footer-contact">
          <div>
            <Mail aria-hidden="true" />
            <p><strong>Email</strong><a href="mailto:info@purehealthpeptides.com">info@purehealthpeptides.com</a></p>
          </div>
          <div><Package aria-hidden="true" /><p><strong>Shipping Days</strong><span>Mon-Fri / Except Holidays</span></p></div>
        </div>

        <div className="footer-disclaimer">
          <p>
            <strong>Disclaimer:</strong> All products sold by Pure Health Peptides LLC are intended for
            laboratory and research purposes only. <strong>They are not for human consumption, veterinary
            use, or medical applications. You must be 21 years or older to purchase.</strong> By using this
            site, you agree to comply with all applicable laws and regulations regarding these products.
            Misuse of these products is strictly prohibited.
          </p>
          <p>
            <strong>FDA Disclaimer:</strong> The statements made within this website have not been evaluated
            by the US Food and Drug Administration. The statements and the products of this company are not
            intended to diagnose, treat, cure or prevent any disease. All products are sold for research,
            laboratory, or analytical purposes only, and are not for human consumption. Pure Health Peptides
            LLC is a chemical supplier. Pure Health Peptides LLC is not a compounding pharmacy or chemical
            compounding facility as defined under 503A of the Federal Food, Drug, and Cosmetic act. Pure
            Health Peptides LLC is not an outsourcing facility as defined under 503B of the Federal Food,
            Drug, and Cosmetic act.
          </p>
        </div>
        <img className="payment-methods" src="/assets/payment-methods.png" alt="Accepted payment methods" />
        <p className="copyright">© 2026, Pure Health Peptides</p>
      </div>
    </footer>
  )
}

function HomePage({ onShop, onProduct, onNavigate }) {
  return (
    <>
      <Hero onGate={onShop} />
      <TopicalEvent onGate={onShop} />
      <Welcome />
      <Catalog onProduct={onProduct} onShop={onShop} />
      <DiscountSection onGate={onShop} />
      <Transparency onNavigate={onNavigate} />
      <Newsletter />
    </>
  )
}

function productOptionLabel(option, index = 0) {
  if (option == null) return `Option ${index + 1}`
  if (typeof option !== 'object') return String(option)
  return String(option.label ?? option.name ?? option.title ?? option.value ?? option.size ?? `Option ${index + 1}`)
}

function productOptionPrice(option, product) {
  const candidate = typeof option === 'object' && option !== null
    ? Number.isInteger(option.priceCents) ? option.priceCents / 100 : option.price ?? option.unitPrice ?? option.sortPrice
    : product?.price
  const parsed = Number.parseFloat(String(candidate ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function productOptionMaxQty(option) {
  const candidate = option && typeof option === 'object'
    ? option.maxQty ?? option.maxQuantity ?? option.stock
    : 99
  const parsed = Number.parseInt(candidate, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 999
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function calculateLinePricing(product, unitPrice, quantity) {
  const subtotal = roundMoney(unitPrice * quantity)
  let discountPercent = 0

  if (quantity >= 2) {
    discountPercent = product?.discountRule === 2
      ? (quantity === 2 ? 5 : 7.5)
      : Math.min(quantity, 15)
  }

  const total = product?.discountRule === 2 && discountPercent > 0
    ? roundMoney(roundMoney(unitPrice * (1 - discountPercent / 100)) * quantity)
    : roundMoney(subtotal * (1 - discountPercent / 100))

  return {
    discountPercent,
    subtotal,
    total,
    savings: roundMoney(subtotal - total),
  }
}

function currentRoute() {
  const normalized = window.location.pathname.replace(/\/+$/, '') || '/'
  if (isProductPath(window.location.pathname)) return 'product'
  return Object.entries(routePaths).find(([, path]) => (path.replace(/\/+$/, '') || '/') === normalized)?.[0] || 'home'
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [gateOpen, setGateOpen] = useState(() => {
    const initialRoute = currentRoute()
    return (initialRoute === 'shop' || initialRoute === 'product') && !hasResearchConfirmation()
  })
  const [pendingRoute, setPendingRoute] = useState('')
  const [pendingProduct, setPendingProduct] = useState(null)
  const [cartItems, setCartItems] = useState(readStoredCart)
  const [previewOrder, setPreviewOrder] = useState(readStoredPreviewOrder)
  const [selectedProduct, setSelectedProduct] = useState(() => productFromPath(window.location.pathname))
  const [productMetadata, setProductMetadata] = useState(null)
  const [shopSearch, setShopSearch] = useState('')
  const initialRender = useRef(true)
  const overlayOpen = menuOpen || searchOpen || cartOpen || gateOpen

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = currentRoute()
      setRoute(nextRoute)
      setSelectedProduct(nextRoute === 'product' ? productFromPath(window.location.pathname) : null)
      setGateOpen((nextRoute === 'shop' || nextRoute === 'product') && !hasResearchConfirmation())
      setPendingRoute('')
      setPendingProduct(null)
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    let active = true
    if (route === 'product' && selectedProduct && !productMetadata) {
      import('./productRouteMetadata.json').then((module) => {
        if (active) setProductMetadata(module.default)
      })
    }
    return () => { active = false }
  }, [route, selectedProduct, productMetadata])

  useEffect(() => {
    const expectedPath = route === 'product' && selectedProduct
      ? productPath(selectedProduct)
      : routePaths[route] || routePaths.home
    const metadata = route === 'product' && selectedProduct
      ? productMetadata?.[canonicalPath(expectedPath)] || {
          path: expectedPath,
          title: productDocumentTitle(selectedProduct),
          description: `${selectedProduct.name} research product information and batch testing from Pure Health Peptides.`,
          kind: 'product',
          indexable: true,
        }
      : routeMetadata[canonicalPath(expectedPath)] || routeMetadata['/']
    const normalizePath = (path) => path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`
    const knownRoute = route === 'product'
      ? Boolean(selectedProduct)
      : normalizePath(window.location.pathname) === normalizePath(expectedPath)
    const title = route === 'product' && !selectedProduct
      ? 'Product Not Found | Pure Health Peptides'
      : metadata.title
    const description = route === 'product' && !selectedProduct
      ? 'This research product is unavailable or is no longer part of the active Pure Health Peptides catalog.'
      : metadata.description
    const configuredOrigin = import.meta.env.VITE_SITE_URL?.trim().replace(/\/$/, '')
    const origin = configuredOrigin || window.location.origin
    const metadataPath = knownRoute ? metadata.path : route === 'product' ? window.location.pathname : routePaths.home
    const canonicalUrl = `${origin}${metadataPath}`
    const socialImage = metadata.image || `${origin}/assets/hero-vials.png`
    const socialImageAlt = metadata.imageAlt || `${title} — Pure Health Peptides`
    const socialImageType = metadata.imageType || (socialImage.toLocaleLowerCase().endsWith('.png') ? 'image/png' : socialImage.toLocaleLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg')
    const indexable = knownRoute && metadata.indexable

    document.title = title
    updateMeta('meta[name="description"]', { name: 'description', content: description })
    updateMeta('meta[name="robots"]', {
      name: 'robots',
      content: indexable
        ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
        : 'noindex, nofollow',
    })
    updateMeta('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl })
    updateMeta('link[rel="alternate"][hreflang="en-US"]', { rel: 'alternate', hreflang: 'en-US', href: canonicalUrl })
    updateMeta('link[rel="alternate"][hreflang="x-default"]', { rel: 'alternate', hreflang: 'x-default', href: canonicalUrl })
    updateMeta('meta[property="og:type"]', { property: 'og:type', content: metadata.kind === 'product' ? 'product' : 'website' })
    updateMeta('meta[property="og:title"]', { property: 'og:title', content: title })
    updateMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    updateMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl })
    updateMeta('meta[property="og:image"]', { property: 'og:image', content: socialImage })
    updateMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: socialImageAlt })
    updateMeta('meta[property="og:image:type"]', { property: 'og:image:type', content: socialImageType })
    updateMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: String(metadata.imageWidth || 1200) })
    updateMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: String(metadata.imageHeight || 630) })
    updateMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
    updateMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    updateMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: socialImage })
    updateMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: socialImageAlt })
    updateStructuredData(knownRoute ? metadata.schema : null)
  }, [route, selectedProduct, productMetadata])

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems))
    } catch {
      // Cart remains usable for the current page session if storage is unavailable.
    }
  }, [cartItems])

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false
      return
    }
    requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
  }, [route, selectedProduct])

  useEffect(() => {
    document.body.classList.toggle('no-scroll', overlayOpen)
    return () => document.body.classList.remove('no-scroll')
  }, [overlayOpen])

  function navigate(nextRoute) {
    if (nextRoute === 'shop' && !hasResearchConfirmation()) {
      setPendingRoute('shop')
      setPendingProduct(null)
      setMenuOpen(false)
      setSearchOpen(false)
      setGateOpen(true)
      return
    }
    const path = routePaths[nextRoute] || routePaths.home
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    setRoute(nextRoute)
    setSelectedProduct(null)
    setMenuOpen(false)
    setSearchOpen(false)
    window.scrollTo(0, 0)
  }

  function navigateProduct(product) {
    if (!hasResearchConfirmation()) {
      setPendingProduct(product)
      setPendingRoute('')
      setMenuOpen(false)
      setSearchOpen(false)
      setGateOpen(true)
      return
    }
    const path = productPath(product)
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    setSelectedProduct(product)
    setRoute('product')
    setMenuOpen(false)
    setSearchOpen(false)
    window.scrollTo(0, 0)
  }

  function requestShop() {
    setMenuOpen(false)
    setCartOpen(false)
    setShopSearch('')
    if (hasResearchConfirmation()) {
      navigate('shop')
      return
    }
    setPendingRoute('shop')
    setPendingProduct(null)
    setGateOpen(true)
  }

  function confirmGate() {
    if (pendingProduct) navigateProduct(pendingProduct)
    else if (pendingRoute) navigate(pendingRoute)
    setPendingRoute('')
    setPendingProduct(null)
  }

  function handleSearch(query) {
    setShopSearch(query)
    if (hasResearchConfirmation()) {
      navigate('shop')
      return
    }
    setPendingRoute('shop')
    setPendingProduct(null)
    setGateOpen(true)
  }

  function addToCart({ product, option, quantity, unitPrice, maxQty }) {
    const resolvedMaxQty = Number.isFinite(maxQty) && maxQty > 0 ? Math.floor(maxQty) : productOptionMaxQty(option)
    const safeQuantity = Math.min(resolvedMaxQty, Math.max(1, quantity))
    const optionName = productOptionLabel(option)
    const parsedUnitPrice = Number.parseFloat(unitPrice)
    const resolvedUnitPrice = Number.isFinite(parsedUnitPrice) ? parsedUnitPrice : productOptionPrice(option, product)
    const variantId = String(option?.id || optionName)
    const key = `${product.id}::${variantId}`
    setCartItems((current) => {
      const existing = current.find((item) => item.key === key)
      const nextQuantity = Math.min(resolvedMaxQty, (existing?.quantity || 0) + safeQuantity)
      const pricing = calculateLinePricing(product, resolvedUnitPrice, nextQuantity)
      const nextLine = { key, product, variantId, sku: option?.sku || product.sku, option: optionName, quantity: nextQuantity, unitPrice: resolvedUnitPrice, maxQty: resolvedMaxQty, ...pricing }
      return existing ? current.map((item) => item.key === key ? nextLine : item) : [...current, nextLine]
    })
    setCartOpen(true)
  }

  function changeCartQuantity(key, quantity) {
    setCartItems((current) => current.map((item) => {
      if (item.key !== key) return item
      const nextQuantity = Math.min(item.maxQty, Math.max(1, quantity))
      return { ...item, quantity: nextQuantity, ...calculateLinePricing(item.product, item.unitPrice, nextQuantity) }
    }))
  }

  async function beginCheckout(items) {
    let result
    try {
      result = await postToSiteService(siteServices.checkoutEndpoint, {
        catalogVersion,
        items: items.map((item) => ({
          productId: item.product.id,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      })
    } catch (error) {
      if (error?.status === 409 || error?.code === 'catalog_changed') {
        setCartItems([])
        try { localStorage.removeItem(CART_STORAGE_KEY) } catch { /* React state is already refreshed. */ }
        throw new Error('The catalog changed and your cart was refreshed. Please add the current variants again.', { cause: error })
      }
      throw error
    }
    const destination = result.checkoutUrl || result.url
    if (!destination) throw new Error('The checkout service did not return a destination URL.')

    const checkoutUrl = new URL(destination, window.location.origin)
    if (!['http:', 'https:'].includes(checkoutUrl.protocol)) {
      throw new Error('The checkout service returned an invalid destination URL.')
    }
    window.location.assign(checkoutUrl.href)
  }

  function openPreviewCheckout() {
    setCartOpen(false)
    navigate('checkout')
  }

  async function placePreviewOrder({ customer, totals }) {
    const placedAt = new Date()
    const order = {
      id: createPreviewOrderId(),
      placedAt: placedAt.toISOString(),
      placedAtLabel: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(placedAt),
      customer,
      totals,
      items: cartItems.map((item) => ({
        key: item.key,
        name: item.product.name,
        option: item.option,
        quantity: item.quantity,
        total: item.total,
      })),
    }

    setPreviewOrder(order)
    try {
      sessionStorage.setItem(PREVIEW_ORDER_STORAGE_KEY, JSON.stringify(order))
    } catch {
      // The receipt remains available in React state if session storage is unavailable.
    }
    setCartItems([])
    navigate('orderConfirmation')
  }

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  function renderPage() {
    if (route === 'checkout') {
      return (
        <CheckoutPage
          items={cartItems}
          onBackToCart={() => setCartOpen(true)}
          onPlaceOrder={placePreviewOrder}
          onShop={requestShop}
        />
      )
    }
    if (route === 'orderConfirmation') return <OrderConfirmationPage order={previewOrder} onShop={requestShop} />
    if (route === 'shop') {
      return (
        <ShopPage
          searchQuery={shopSearch}
          onAddToCart={addToCart}
          onLearnMore={navigateProduct}
          onNavigate={navigate}
        />
      )
    }
    if (route === 'about') return <><AboutPage onShop={requestShop} onNavigate={navigate} /><Newsletter /></>
    if (route === 'research') return <ResearchAreasPage />
    if (route === 'news') return <><NewsPage onShop={requestShop} /><Newsletter /></>
    if (route === 'elite') return <><ElitePage onShop={requestShop} onNavigate={navigate} /><Newsletter /></>
    if (route === 'account') return <AccountPage />
    if (route === 'track') return <TrackOrderPage />
    if (route === 'faqs') return <FaqPage />
    if (route === 'contact') return <><ContactPage /><Newsletter /></>
    if (route === 'shippingPolicy') return <PolicyPage type="shipping" />
    if (route === 'refundPolicy') return <PolicyPage type="refunds" />
    if (route === 'privacyPolicy') return <PolicyPage type="privacy" />
    if (route === 'terms') return <PolicyPage type="terms" />
    if (route === 'productInfo') return <ProductInfoPage />
    if (route === 'testing') return <><CoaProcessPage onNavigate={navigate} /><Newsletter /></>
    if (route === 'manufacturing') return <><ManufacturingPage onNavigate={navigate} /><Newsletter /></>
    if (route === 'dilution') return <DilutionGuidePage />
    if (route === 'coaLibrary') return <><CoaLibraryPage onNavigate={navigate} /><Newsletter /></>
    if (route === 'coaVials') return <CoaCategoryPage category="vials" />
    if (route === 'coaCapsules') return <CoaCategoryPage category="capsules" />
    if (route === 'coaLiquids') return <CoaCategoryPage category="liquids" />
    if (route === 'coaTopicals') return <CoaCategoryPage category="topicals" />
    if (route === 'product') {
      if (!selectedProduct) {
        return <Suspense fallback={<div className="route-loader" role="status">Loading product…</div>}><ProductNotFoundPage onShop={requestShop} /></Suspense>
      }
      const ProductDetailRoute = productDetailRoutes[selectedProduct.type]
      if (!ProductDetailRoute) {
        return <Suspense fallback={<div className="route-loader" role="status">Loading product…</div>}><ProductNotFoundPage onShop={requestShop} /></Suspense>
      }
      return (
        <Suspense fallback={<div className="route-loader" role="status">Loading product…</div>}>
          <ProductDetailRoute
            product={selectedProduct}
            onAddToCart={addToCart}
            onNavigate={navigate}
            onProduct={navigateProduct}
          />
          {selectedProduct.type === 'topicals' && <Newsletter />}
        </Suspense>
      )
    }
    return <HomePage onShop={requestShop} onProduct={navigateProduct} onNavigate={navigate} />
  }

  return (
    <>
      <div className="app-content" inert={overlayOpen} aria-hidden={overlayOpen || undefined}>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <Header
          onMenu={() => setMenuOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onCart={() => setCartOpen(true)}
          onHome={() => navigate('home')}
          onShop={requestShop}
          onNavigate={navigate}
          cartCount={cartCount}
        />
        <main id="main-content" tabIndex="-1">
          {renderPage()}
        </main>
        <Footer onNavigate={navigate} />
      </div>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onShop={requestShop} onNavigate={navigate} />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} onSubmitSearch={handleSearch} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onShop={() => { setCartOpen(false); navigate('shop') }}
        items={cartItems}
        onRemove={(key) => setCartItems((current) => current.filter((item) => item.key !== key))}
        onChangeQuantity={changeCartQuantity}
        onCheckout={beginCheckout}
        onPreviewCheckout={openPreviewCheckout}
        checkoutConfigured={Boolean(siteServices.checkoutEndpoint)}
      />
      <ResearchGate
        open={gateOpen}
        onClose={() => { setGateOpen(false); setPendingRoute(''); setPendingProduct(null) }}
        onConfirm={confirmGate}
        onLeave={() => window.location.replace('https://www.google.com/')}
      />
    </>
  )
}
