import { ShieldCheck, ClipboardList, Truck, TestTube2, Info } from 'lucide-react'
import Catalog from './Catalog.jsx'
import ResponsiveImage from './ResponsiveImage.jsx'
import ResearchResources from './ResearchResources.jsx'
import { appPath } from './appPath.js'
import './home.css'
const routePaths = { shop: appPath('/shop/'), coaLibrary: appPath('/coa-library/') }
const followShop = (event, onGate) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onGate() }

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
            <ResponsiveImage src="/assets/hero-vials.png" alt="" loading="lazy" fetchPriority="high" sizes="(max-width: 800px) 90vw, 600px" />
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
          <ResponsiveImage src="/assets/topical-event.png" alt="Pure Health Peptides topical discovery collection" />
        </div>
        <div className="topical-copy">
          <p className="eyebrow">INTRODUCING</p>
          <h2>PHP — TOPICAL DISCOVeRY eVeNT</h2>
          <p className="event-offer">
            For a limited period — <strong>Receive your Complimentary PHP Discovery Collection</strong>
            {' '}with qualifying research orders of <strong>$500 or more*</strong>
          </p>
          <small>*after discount, before fees and taxes</small>
          <ResponsiveImage
            className="topical-mobile-product"
            src="/assets/topical-event.png"
            alt="Pure Health Peptides topical discovery collection"
          />
          <a className="topical-link" href={routePaths.shop} onClick={(event) => followShop(event, onGate)}>
            Discover the PHP Topical Format System.
          </a>
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
            <li><strong>Orders of $175 or more after discounts:</strong> Free Shipping on your entire order—no hassle, no hidden fees.</li>
          </ul>
          <a className="button button-primary" href={routePaths.shop} onClick={(event) => followShop(event, onGate)}>SHOP NOW</a>
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
          <ResponsiveImage src="/assets/coa-documents.png" alt="Pure Health Peptides certificates of analysis" />
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

export default function HomePage({ onShop, onProduct, onNavigate, onAddToCart }) {
  return (
    <>
      <Hero onGate={onShop} />
      <TopicalEvent onGate={onShop} />
      <Welcome />
      <Catalog onProduct={onProduct} onShop={onShop} onAddToCart={onAddToCart} />
      <DiscountSection onGate={onShop} />
      <Transparency onNavigate={onNavigate} />
      <ResearchResources />
    </>
  )
}
