import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import './about.css'

const researchAreas = [
  {
    title: 'Metabolic',
    copy: 'Research focused on metabolic signaling pathways involved in energy balance, nutrient utilization, appetite regulation, and glucose homeostasis. This area explores how peptide-based research compounds interact with systems governing metabolism, insulin sensitivity, and whole-body energy regulation.',
    focus: 'Metabolic signaling • Energy balance • Nutrient sensing',
  },
  {
    title: 'Growth & Repair',
    copy: 'Research centered on pathways involved in growth hormone signaling, tissue repair, and recovery mechanisms. This category includes compounds studied for their role in growth factor modulation, cellular repair signaling, and musculoskeletal research models.',
    focus: 'Growth signaling • Tissue repair • Recovery pathways',
  },
  {
    title: 'Regeneration & Longevity',
    copy: 'Research exploring cellular renewal, senescence, and age-associated biological processes. This area examines peptides studied for their role in regenerative signaling, cellular maintenance, and long-term biological resilience.',
    focus: 'Cellular regeneration • Longevity pathways • Senescence research',
  },
  {
    title: 'Cognitive & Neuro',
    copy: 'Research dedicated to neurotransmission, neuroprotection, and cognitive signaling pathways. This category includes compounds studied in models of learning, memory, stress response, and nervous system regulation.',
    focus: 'Neuroactive signaling • Cognitive pathways • Nervous system research',
  },
  {
    title: 'Immune & Inflammatory',
    copy: 'Research focused on immune modulation, inflammatory signaling, and host-defense pathways. This area examines peptides studied for their interaction with innate and adaptive immune systems.',
    focus: 'Immune signaling • Inflammatory regulation • Host defense',
  },
  {
    title: 'Dermal, Hair & Tissue Appearance',
    copy: 'Research centered on dermal structure, extracellular matrix integrity, pigmentation, and tissue appearance. This category includes compounds studied in skin biology, connective tissue research, and cosmetic science models.',
    focus: 'Dermal biology • Extracellular matrix • Tissue appearance',
  },
  {
    title: 'Reproductive & Neuroendocrine',
    copy: 'Research involving reproductive signaling pathways and neuroendocrine regulation related to sexual behavior and fertility models. This area focuses on peptides studied for their role in reproductive hormone signaling and behavioral research.',
    focus: 'Reproductive signaling • Neuroendocrine pathways • Behavioral research',
  },
  {
    title: 'Mitochondrial & Cellular Energy',
    copy: 'Research dedicated to mitochondrial function, cellular energy production, and redox balance. This category includes peptides studied for their involvement in bioenergetics, oxidative stress, and cellular metabolism.',
    focus: 'Mitochondrial function • Bioenergetics • Cellular metabolism',
  },
  {
    title: 'Oncology & Cell Fate (Exploratory)',
    copy: 'Exploratory research focused on cell cycle regulation, apoptosis, senescence, and tumor-suppressive signaling pathways. This area includes peptides studied in advanced research models related to cell fate and disease mechanisms.',
    focus: 'Cell fate • Apoptosis • Senescence research',
  },
]

const newsItems = [
  {
    title: 'Bacteriostatic Water in Peptide Research: Reconstitution Solvent Selection and Stability Considerations',
    image: '/assets/about/news-bacteriostatic-water.jpg',
  },
  {
    title: 'GHK-Cu Research Peptide: Copper Tripeptide and Dermal Signaling Pathways',
    image: '/assets/about/news-ghk-cu.jpg',
  },
  {
    title: 'KPV Research Peptide: Melanocortin-Derived Tripeptide and Inflammatory Pathway Research',
    image: '/assets/about/news-kpv.jpg',
  },
  {
    title: 'Why Manufacturing Source and Verification Matter in Research Peptide Quality',
    image: '/assets/about/news-manufacturing.png',
  },
  {
    title: 'SLU-PP-332 Research Compound: ERR Receptor Activation and Metabolic Pathway Modulation',
    image: '/assets/about/news-slu-pp-332.jpg',
  },
  {
    title: 'PT-141 Research Peptide: Melanocortin Receptor Pathway and Neuropeptide Signaling',
    image: '/assets/about/news-pt-141.png',
  },
]

const relatedProducts = [
  { title: 'Complete Configuration – Modular Peptide Systems A+B+C+D+E', price: '$399.00', image: '/assets/about/related-complete.jpg' },
  { title: 'Phase 2 Configuration – Modular Peptide Systems B+D', price: '$179.00', image: '/assets/about/related-phase-2.jpg' },
  { title: 'Phase 1 Configuration – Modular Peptide Systems A+C+E', price: '$239.00', image: '/assets/about/related-phase-1.jpg' },
  { title: 'Modular Peptide System E – Multi-Peptide Complex', price: '$129.00', image: '/assets/about/related-system-e.jpg' },
]

const eliteTiers = [
  { name: 'PLATINUM ACCESS', discount: '10% automatic discount', image: '/assets/about/elite-platinum.png' },
  { name: 'GOLD ACCESS', discount: '7.5% automatic discount', image: '/assets/about/elite-gold.png' },
  { name: 'SILVER ACCESS', discount: '5% automatic discount', image: '/assets/about/elite-silver.png' },
]

const faqItems = [
  ['Do I need a code?', 'No. If eligible, your tier discount applies automatically at checkout.'],
  ['Can I combine with promotions?', 'No. Choose either a promotion or Elite Access. Discounts don’t stack.'],
  ['How often is status reviewed?', 'Periodically, using quarterly purchase history and account activity.'],
  ['Is this medical guidance?', 'No. The program is purchase-activity based. All products remain For Research Use Only.'],
]

function PageButton({ children, onClick, outline = false }) {
  return (
    <button className={`about-pill${outline ? ' about-pill-outline' : ''}`} type="button" onClick={onClick}>
      {children}
    </button>
  )
}

export function AboutPage({ onShop, onNavigate }) {
  return (
    <div className="about-page about-us-page">
      <section className="about-hero about-hero-standard">
        <div className="about-hero-content">
          <h1>About US</h1>
          <p><strong>Pure Science, Pure Innovation</strong> &nbsp;–&nbsp; At Pure Health Peptides, we are revolutionizing the way researchers and laboratories approach the study of peptides and their potential. Our mission is simple yet profound: to provide the highest-quality research-grade peptides while adhering to the strictest regulatory standards at the best possible price. As an e-commerce platform built on precision, innovation, and trust, we are redefining the landscape of peptide research.</p>
          <PageButton onClick={onShop}>SHOP NOW</PageButton>
        </div>
      </section>

      <section className="about-intro-section">
        <div className="about-two-column">
          <article>
            <h2>Who We Are</h2>
            <p>At Pure Health Peptides, we combine extensive business expertise with a strong passion for innovation to deliver premium research-grade peptides. While our team’s experience spans a variety of innovative industries, we also partner with leading experts in biochemistry and biology to ensure the highest standards in quality and compliance. Pure Health Peptides is not just another peptide supplier. We stand apart by offering:</p>
            <ul>
              <li><strong>Unrivaled Quality</strong> – We source, test, and verify each peptide through rigorous analytical processes, ensuring the highest purity and consistency.</li>
              <li><strong>Best Possible Pricing</strong> – By streamlining sourcing and manufacturing, we eliminate unnecessary markups, making high-quality peptides affordable for all researchers.</li>
              <li><strong>Strict Regulatory Compliance</strong> – We uphold the highest industry standards, providing fully certified peptides for research use only.</li>
              <li><strong>Seamless Ordering Experience</strong> – A user-friendly platform, fast shipping, real-time tracking and dedicated customer support to keep your research moving forward without delays.</li>
            </ul>
            <PageButton outline onClick={() => onNavigate('coaLibrary')}>View Our Certificates</PageButton>
          </article>
          <article>
            <h2>Why Peptides?</h2>
            <p>Peptides play a critical role in biomedical and life sciences research, contributing to advancements in metabolism, cellular repair, immune function, and molecular signaling. As highly specific protein components, they are essential tools for investigating biological processes and therapeutic potential. At Pure Health Peptides, we provide researchers with the precision materials needed to advance scientific understanding, supporting research that may lead to future innovations in various fields of study.</p>
            <h2>Buy More, Save More</h2>
            <p>Pure Health Peptides offers exclusive savings with a simple “Order More, Save More” discount structure—buy more vials of the same product and unlock bigger discounts, starting at 2% off for 2 vials, 3% off for 3 vials, and up to 15% off for 15+ vials. Plus, enjoy special perks: orders over $75 receive a free Vial Vault for secure storage and orders over $175* (net product value after discounts*) enjoy free shipping.</p>
            <PageButton onClick={onShop}>SHOP NOW</PageButton>
          </article>
        </div>
      </section>

      <section className="whats-next-section">
        <div>
          <h2>What’s Next?</h2>
          <p>Pure Health Peptides is more than a platform—it’s a partner in discovery. We are here to support and accelerate research breakthroughs, providing world-class peptides and an exceptional customer experience. As peptide research continues to evolve, we remain at the forefront—driving innovation, ensuring quality, and empowering researchers with the tools they need to succeed. Explore our catalog and discover what’s next—where pure science meets pure innovation.</p>
          <PageButton outline onClick={() => onNavigate('contact')}>Contact Us</PageButton>
        </div>
      </section>
    </div>
  )
}

export function ResearchAreasPage() {
  return (
    <div className="about-page research-page">
      <section className="research-content">
        <h1>Research Areas</h1>
        <p className="research-lead">Our research areas are designed to organize peptide compounds by biological pathways and scientific focus, rather than by individual product names. Each category reflects a recognized domain of ongoing biomedical and biochemical research.</p>
        <div className="research-grid">
          {researchAreas.map((area) => (
            <article key={area.title}>
              <h2>{area.title}</h2>
              <p>{area.copy}</p>
              <p><strong>Primary research focus:</strong><br />{area.focus}</p>
            </article>
          ))}
        </div>
        <div className="research-closing">
          <h2>Closing Note</h2>
          <p>These research categories are intended to support scientific organization and discovery. Individual compounds may be relevant to more than one research area depending on the biological pathway under investigation.</p>
        </div>
        <section className="mapping-section">
          <h2>Research Area &amp; Compound Mapping Matrix</h2>
          <img src="/assets/about/research-matrix.png" alt="Research area and compound mapping matrix" />
          <div className="matrix-legend">
            <h3>Legend</h3>
            <p>✓ Primary research relevance – Compounds may appear in multiple research areas due to overlapping biological pathways.</p>
            <p>Categories reflect biological pathway involvement, not product intent</p>
          </div>
          <div className="research-closing research-closing-final">
            <h2>Closing Note</h2>
            <p>These research categories and mappings are intended to support scientific organization and discovery. They do not imply specific outcomes, applications, or uses.</p>
          </div>
        </section>
      </section>
    </div>
  )
}

export function NewsPage({ onShop }) {
  const excerpt = 'FOR RESEARCH USE ONLY. The content provided in this article is for educational and informational purposes only and is based on published scientific literature. The compounds discussed are not approved'

  return (
    <div className="about-page news-page">
      <section className="news-content">
        <h1>Recent news</h1>
        <div className="news-grid">
          {newsItems.map((item) => (
            <article className="news-card" key={item.title}>
              <img src={item.image} alt="" />
              <div>
                <h2>{item.title}</h2>
                <p>{excerpt}</p>
                <span className="news-preview-label">Research article preview</span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="related-section">
        <h2>Related Products</h2>
        <div className="related-grid">
          {relatedProducts.map((product) => (
            <article key={product.title}>
              <img src={product.image} alt={product.title} />
              <h3>{product.title}</h3>
              <p>{product.price}</p>
              <button type="button" onClick={onShop}>SELECT OPTIONS</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function EliteFaq() {
  const [open, setOpen] = useState(0)

  return (
    <section className="elite-faq">
      <div>
        <h2>FAQ</h2>
        {faqItems.map(([question, answer], index) => {
          const expanded = open === index
          return (
            <article className={expanded ? 'is-open' : ''} key={question}>
              <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? -1 : index)}>
                {question}<ChevronDown aria-hidden="true" />
              </button>
              <div className="elite-faq-answer"><p>{answer}</p></div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function ElitePage({ onShop, onNavigate }) {
  return (
    <div className="about-page elite-page">
      <section className="about-hero elite-hero">
        <div className="about-hero-content">
          <h1>PURE ELITE ACCESS</h1>
          <h2>Research<br className="mobile-break" /> Account Loyalty Program</h2>
          <p>Pure Elite Access is our account-based loyalty program designed for customers who regularly purchase research compounds from Pure Health Peptides. The program rewards long-term purchasing activity with automatic pricing benefits and priority access — while maintaining our strict For Research Use Only standards.</p>
          <PageButton onClick={onShop}>EARN MORE - SHOP NOW</PageButton>
          <p className="elite-hero-note">Participation is based solely on periodic (quarterly) purchase history and account activity. No medical information, use cases, or outcomes are involved.</p>
        </div>
      </section>

      <section className="elite-welcome">
        <div className="elite-welcome-grid">
          <article className="elite-welcome-copy">
            <p className="elite-kicker">Welcome to</p>
            <h2>PURE ELITE ACCESS</h2>
            <h3>Where Science and Research Meet Excellence.</h3>
            <p>Pure Elite Access recognizes consistent research purchasing with tiered benefits. There are no applications, no codes, and no manual steps. If your account qualifies, benefits apply automatically at checkout.</p>
            <p><strong>Access Process:</strong></p>
            <ul>
              <li>Automatic savings on eligible orders</li>
              <li>Priority access when available</li>
              <li>Quarterly account review</li>
            </ul>
          </article>
          <div className="elite-tier-list">
            {eliteTiers.map((tier) => (
              <article key={tier.name}>
                <img src={tier.image} alt="" />
                <div><h3>{tier.name}</h3><p>{tier.discount}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="elite-how">
        <h2>How it works</h2>
        <div>
          <img src="/assets/about/elite-earn-points.jpg" alt="Earn points with every completed order" />
          <img src="/assets/about/elite-points.jpg" alt="Points build your Pure Elite Access level" />
          <img src="/assets/about/elite-tier-status.jpg" alt="Tier status is reviewed periodically" />
        </div>
      </section>

      <section className="elite-terms">
        <article>
          <h2>Program Progression &amp; Tier Qualification</h2>
          <p>Pure Elite Access is a rolling loyalty program based on completed purchase activity and accumulated account points over individualized evaluation periods tied to each account’s purchase history. The program does not operate on fixed calendar quarters.</p>
          <p>Members progress through tier levels by reaching qualifying point thresholds within their active evaluation period:</p>
          <ul>
            <li><strong>Silver Tier — Unlocks at 75 points</strong><br />Includes a 5% automatic site-wide discount</li>
            <li><strong>Gold Tier — Unlocks at 150 points</strong><br />Includes a 7.5% automatic site-wide discount</li>
            <li><strong>Platinum Tier — Unlocks at 250 points</strong><br />Includes a 10% automatic site-wide discount</li>
          </ul>
          <p>Applicable Pure Elite discounts are automatically applied at checkout and may additionally stack with available volume-based pricing adjustments where applicable.</p>
          <p>Once a tier has been unlocked, ongoing account activity and purchase history are periodically reviewed to determine whether the account:</p>
          <ul><li>maintains its current tier,</li><li>progresses to a higher tier,</li><li>or falls below the applicable maintenance threshold.</li></ul>
          <p>To promote continuity and reduce abrupt status changes, each tier includes a built-in protection period, as outlined below.</p>
        </article>
        <article>
          <h2>Notifications, Promotions &amp; Stability, Automatic Progress Notifications</h2>
          <p>Automated emails notify you as your account approaches a new tier and when a tier is unlocked. These notifications are provided for informational purposes only. Loyalty discounts are applied automatically at checkout—no manual action is required.</p>
        </article>
        <article>
          <h2>Discounts &amp; Promotions</h2>
          <p>During promotional periods, you may elect to apply either your Pure Elite Access discount or an active promotional offer. Discounts are not combinable and may not be stacked. In case you use a promotion code and want to restore your personal ‘Pure Elite Discount Code’, please access your account and copy-paste your code into the Discount Code check-out area.</p>
        </article>
        <article>
          <h2>Tier Stability &amp; Grace Period</h2>
          <p>To promote continuity and avoid abrupt tier changes, each tier includes a three (3) month protection period if an account temporarily falls below the applicable point threshold. This protection applies only to minor shortfalls. If, during a quarterly review period, an account falls materially below the required threshold—defined as more than:</p>
          <p>— 8 points below Silver &nbsp;— 15 points below Gold &nbsp;— 25 points below Platinum —</p>
          <p>Then, the grace period will not apply, and tier status will be adjusted accordingly.</p>
        </article>
        <article>
          <h2>Program Scope &amp; Research Use Limitation</h2>
          <p>Pure Elite Access is based solely on completed purchase activity and account history. It does not involve or consider medical information, intended use, outcomes, or recommendations.</p>
          <p>All products remain strictly <strong>For Research Use Only</strong>, and participation in the program does not alter or expand the permitted use of any product.</p>
        </article>
        <article>
          <h2>Governing Terms</h2>
          <p>Pure Elite Access is subject to the Company’s Terms &amp; Conditions. In the event of any conflict, the Terms &amp; Conditions shall control.</p>
        </article>
        <article>
          <h2>Program Administration &amp; Modifications</h2>
          <p>Pure Health Peptides reserves the right to modify, suspend, or terminate the Pure Elite Access program, in whole or in part, at any time, at its sole discretion. The Company also reserves the right to deny, suspend, or revoke participation in the program for any account that fails to comply with applicable Terms &amp; Conditions, including but not limited to violations of the “For Research Use Only” requirements. Any changes to the program will be applied in a commercially reasonable and non-discriminatory manner.</p>
        </article>
        <PageButton outline onClick={() => onNavigate('contact')}>Contact Us</PageButton>
      </section>

      <section className="elite-details">
        <div>
          <article>
            <h2>Discounts &amp; promotions</h2>
            <p>Pure Elite Access discounts are assigned based on your individual tier level (Silver, Gold, or Platinum). Each tier includes a unique, automatically applied discount code that reflects your status.</p>
            <p>Your tier-specific discount code will apply automatically at checkout when you are logged into your account.</p>
            <p>During special promotions, discount codes cannot be stacked. If you prefer to use an active promotional code instead of your Elite tier discount, simply remove your tier code at checkout and enter the promotional code in the coupon code box and click apply.</p>
            <PageButton onClick={onShop}>SHOP NOW</PageButton>
          </article>
          <article>
            <h2>Tier stability</h2>
            <p>To provide continuity, tiers may include a limited protection period if an account temporarily dips below the usual activity level.</p>
            <div className="elite-mini-tiers">
              {eliteTiers.map((tier) => <img src={tier.image} alt={tier.name} key={tier.name} />)}
            </div>
          </article>
        </div>
      </section>

      <EliteFaq />
    </div>
  )
}
