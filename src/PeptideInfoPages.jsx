import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  coaReadingSteps,
  coaRedFlags,
  infoCards,
  manufacturingIntro,
  manufacturingTesting,
  verificationSteps,
} from './peptideInfoData.js'
import useDialogFocus from './useDialogFocus.js'
import './peptideInfo.css'

function InfoButton({ children, onClick, href, outline = false }) {
  const className = `info-button${outline ? ' info-button-outline' : ''}`
  if (href) return <a className={className} href={href} target="_blank" rel="noreferrer">{children}</a>
  return <button className={className} type="button" onClick={onClick}>{children}</button>
}

function NumberedSteps({ items, className = '' }) {
  return (
    <div className={`numbered-steps ${className}`}>
      {items.map((item, index) => (
        <article key={item.title}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div><h3>{item.title}</h3><p>{item.copy}</p></div>
        </article>
      ))}
    </div>
  )
}

function ScientificQuote({ children, author, compact = false }) {
  return (
    <section className={`scientific-quote${compact ? ' scientific-quote-compact' : ''}`}>
      <div>
        <img src="/assets/peptide-info/quote.png" alt="" />
        <blockquote>{children}</blockquote>
        <p>— {author}</p>
      </div>
    </section>
  )
}

export function ProductInfoPage() {
  const [visibleCards, setVisibleCards] = useState(12)

  return (
    <div className="peptide-info-page product-info-page">
      <section className="info-card-hero"><h1>Product Info Cards</h1></section>
      <section className="info-card-library">
        <div className="info-card-grid">
          {infoCards.slice(0, visibleCards).map((card) => (
            <article className="info-guide-card" key={card.title}>
              <img src={card.image} alt={`${card.title} research information card`} />
              <h2>{card.title}</h2>
              <a href={card.guide} target="_blank" rel="noreferrer">DOWNLOAD</a>
            </article>
          ))}
        </div>
        {visibleCards < infoCards.length && (
          <button className="info-load-more" type="button" onClick={() => setVisibleCards((current) => Math.min(current + 12, infoCards.length))}>
            LOAD MORE
          </button>
        )}
      </section>
    </div>
  )
}

const testingCards = [
  { title: 'Identity', icon: 'identity.svg', copy: 'Is the peptide in the vial the peptide on the label?', proof: 'Confirmed by HPLC-MS.' },
  { title: 'Purity', icon: 'purity.svg', copy: 'How much is the intended compound?', proof: 'Quantified per lot. Reported as a number.' },
  { title: 'Quantity', icon: 'quantity.svg', copy: 'Does the vial contain what the label states?', proof: 'Mass verified, not estimated.' },
  { title: 'Quality', icon: 'quality.svg', copy: 'Was the batch produced through a clean, controlled, process?', proof: 'Each batch is tested for endotoxins and microbial contamination in accordance with USP <85>, <61>, and <62>.' },
]

export function CoaProcessPage({ onNavigate }) {
  const [slide, setSlide] = useState(0)
  const slides = ['/assets/peptide-info/coa-slide-1.png', '/assets/peptide-info/coa-slide-2.png']

  return (
    <div className="peptide-info-page coa-process-page">
      <section className="testing-matters">
        <div className="scientific-heading">
          <p>Testing Process</p>
          <h1>Why testing matters</h1>
          <strong>“99% purity” is only a claim until independent verification proves it.</strong>
        </div>
        <div className="testing-card-grid">
          {testingCards.map((card) => (
            <article key={card.title}>
              <img src={`/assets/peptide-info/${card.icon}`} alt="" />
              <h2>{card.title}</h2>
              <p>{card.copy}</p>
              <strong>{card.proof}</strong>
            </article>
          ))}
        </div>
        <p className="testing-caption">Every batch. Every product. Published in the COA Library, retrievable by batch ID.</p>
        <div className="info-button-row">
          <InfoButton href="https://purehealthpeptides.com/coa-library/">VIEW COA LIBRARY</InfoButton>
          <InfoButton outline onClick={() => onNavigate('manufacturing')}>READ MANUFACTURING PROCESS</InfoButton>
        </div>
      </section>

      <section className="iso-section scientific-copy-section">
        <h2>ISO/IeC 17025: the gOlD stanDarD</h2>
        <p>Our testing partner is Ethos Analytics, accredited to ISO/IEC 17025 (Accreditation #: 117798 / License #: 000026LRCND60176649) — the international standard for the technical competence of testing and calibration laboratories. Accreditation is granted by independent bodies after on-site assessment and is maintained through unannounced surveillance audits.</p>
        <p>Most peptide vendors lean on chromatograms as their proof of testing. A chromatogram shows the test was performed. It doesn’t show whether the instrument was calibrated, the analyst qualified, the method validated, or the result reproducible.</p>
        <p>ISO 17025 answers all of that before the test is ever run. Every step documented. Every procedure auditable. Every result traceable.</p>
      </section>

      <section className="verification-section">
        <div className="verification-grid">
          <img className="verification-lab" src="/assets/peptide-info/coa-lab.png" alt="Research vial in an analytical laboratory" />
          <div>
            <h2>THe PURe HeALTH VeRIFICATION PROCeSS</h2>
            <p>Every batch follows a structured verification process designed to provide traceability, independent testing, and public transparency.</p>
            <NumberedSteps items={verificationSteps} />
          </div>
        </div>
      </section>

      <ScientificQuote author="Nisrin Samsum, CEO, Ethos Analytics">
        <strong>A screenshot of a chromatogram may be visually appealing, but by itself, it has limited value from a quality and traceability standpoint.</strong>
        <span>Screenshots can be reused, cropped, or separated from the original data package, which means they do not independently demonstrate sample identity, method execution, instrument traceability, data integrity, or proper review.</span>
        <span>ISO/IEC 17025 accreditation shows the system behind an outcome. It demonstrates that the laboratory operates under defined requirements for technical competence, impartiality, documentation, equipment control, method execution, and result review.</span>
        <span>In other words, the chromatogram supports the result, while accreditation supports the credibility of the process used to generate it.</span>
      </ScientificQuote>

      <section className="coa-reading-section">
        <div className="coa-reading-grid">
          <div>
            <h2>HOw tO reaD yOur COA</h2>
            <p>When you open a COA from our library, here is what each field tells you and how to evaluate it.</p>
            <NumberedSteps items={coaReadingSteps} className="coa-read-steps" />
            <h2 className="red-flags-heading">ReD flags in a COA</h2>
            <p>When evaluating a COA from any supplier, the following are warning signs:</p>
            <NumberedSteps items={coaRedFlags} className="red-flag-steps" />
          </div>
          <aside className="coa-visual-column">
            <div className="coa-carousel">
              <button type="button" aria-label="Previous COA page" onClick={() => setSlide((current) => (current + slides.length - 1) % slides.length)}><ChevronLeft /></button>
              <img src={slides[slide]} alt={`Certificate of Analysis example page ${slide + 1}`} />
              <button type="button" aria-label="Next COA page" onClick={() => setSlide((current) => (current + 1) % slides.length)}><ChevronRight /></button>
              <div aria-label={`Slide ${slide + 1} of ${slides.length}`}><span className={slide === 0 ? 'active' : ''} /><span className={slide === 1 ? 'active' : ''} /></div>
            </div>
            <div className="coa-side-quote">
              <img src="/assets/peptide-info/quote-small.png" alt="" />
              <blockquote>More tests on a COA do not necessarily mean better testing. The real measure is whether the tests performed are relevant, scientifically justified and appropriate for verifying the material produced.</blockquote>
              <p>— Nisrin Samsum<br />CEO, Ethos Analytics</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="testing-manufacturing-link scientific-copy-section">
        <h2>HOw testing cOnnects tO manufacturing</h2>
        <p>Testing answers one half of the sourcing question — what is actually in the vial. The other half is where the material comes from and how it is made.</p>
        <p>For the full picture of how Pure Health Peptides products are produced, including our domestic finishing operations and the chemical synthesis methods used to produce our peptides, see our Manufacturing Process page.</p>
        <p>For verifiable batch-level proof of testing for any specific product you have received, search for your batch ID in the COA Library.</p>
        <div className="info-button-row">
          <InfoButton onClick={() => onNavigate('manufacturing')}>VIEW MANUFACTURING PROCESS</InfoButton>
          <InfoButton outline href="https://purehealthpeptides.com/coa-library/">VIEW COA LIBRARY</InfoButton>
        </div>
      </section>
    </div>
  )
}

export function ManufacturingPage({ onNavigate }) {
  return (
    <div className="peptide-info-page manufacturing-page">
      <section className="manufacturing-intro scientific-copy-section">
        <p className="scientific-kicker">OUR PEPTIDES</p>
        <h1>Where they cOme frOm.<br />HOw they're maDe.</h1>
        {manufacturingIntro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>

      <ScientificQuote author="Nisrin Samsum, CEO, Ethos Analytics" compact>
        <strong>More tests on a COA do not necessarily mean better testing. The relevant question is whether the tests reported are the ones that verify quality for the manufacturing method that produced the material.</strong>
      </ScientificQuote>

      <section className="manufacturing-testing scientific-copy-section">
        <h2>What Our manufacturing methOD means fOr testing</h2>
        {manufacturingTesting.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <div className="info-button-row">
          <InfoButton onClick={() => onNavigate('testing')}>VIEW TESTING PROCESS</InfoButton>
          <InfoButton outline href="https://purehealthpeptides.com/coa-library/">VIEW COA LIBRARY</InfoButton>
        </div>
      </section>
    </div>
  )
}

const dilutionFaqs = [
  {
    question: 'Why is bacteriostatic water listed as the primary diluent',
    answer: 'Bacteriostatic water is widely used in research settings because it provides reliable aqueous solubility for most peptides and contains a preservative that helps limit microbial growth in multi-use research vials. In research contexts, bacteriostatic water is commonly abbreviated as BAC, which is the notation used throughout the dilution table. For these reasons, BAC is recommended as the standard starting diluent unless otherwise indicated.',
  },
  {
    question: 'What does “BAC*” mean in the dilution table?',
    answer: '“BAC*” indicates that bacteriostatic water (BAC) is the preferred starting diluent, but the compound may exhibit solubility variability or sensitivity depending on batch characteristics or handling conditions. These compounds may require additional care during reconstitution, and acidification is not routinely required.',
  },
  {
    question: 'When is acetic acid used for peptide dilution?',
    answer: 'Acetic acid may be used as a solubility aid for specific peptides that are known to be aggregation-prone, hydrophobic, or protein-like in structure. It is considered a compound-specific exception and is not required for most peptides.',
  },
  {
    question: 'Does this guide provide dosing or usage instructions?',
    answer: 'No. This dilution guide is provided solely as a research handling reference. It does not provide dosing, administration, or usage instructions, and all products are offered for research use only.',
  },
]

function DilutionSection({ title, children }) {
  return (
    <section className="dilution-copy-section">
      <h4>{title}</h4>
      {children}
    </section>
  )
}

export function DilutionGuidePage() {
  const [chartOpen, setChartOpen] = useState(false)
  const closeButtonRef = useRef(null)
  const dialogRef = useDialogFocus(chartOpen, () => setChartOpen(false), { initialFocusRef: closeButtonRef })

  useEffect(() => {
    if (!chartOpen) return undefined
    document.body.classList.add('no-scroll')
    return () => {
      document.body.classList.remove('no-scroll')
    }
  }, [chartOpen])

  return (
    <div className="peptide-info-page dilution-guide-page">
      <div className="dilution-guide-inner" inert={chartOpen} aria-hidden={chartOpen || undefined}>
        <h1>Dilution Recommendation Guide</h1>

        <DilutionSection title="Why Dilution Matters in Research">
          <p>In peptide research, proper dilution is an important part of handling lyophilized (freeze-dried) compounds. The choice of diluent can influence solubility, stability, and consistency during laboratory work. Because peptides vary in structure, sequence, and physicochemical properties, dilution guidance is based on best practices rather than one universal rule.</p>
        </DilutionSection>

        <DilutionSection title="Understanding Peptide Dilution">
          <p>Peptides are commonly supplied in lyophilized form and must be reconstituted prior to use in research environments. Selecting an appropriate diluent helps support:</p>
          <ul>
            <li>Structural integrity and stability</li>
            <li>Consistent solubility in aqueous systems</li>
            <li>Reduced risk of degradation related to pH or handling variability</li>
          </ul>
          <p>The optimal diluent depends on the characteristics of the individual peptide.</p>
        </DilutionSection>

        <DilutionSection title="Acetic Acid as a Solubility Aid (Exception)">
          <p>In certain cases, mild acidification (commonly 0.6% acetic acid) may improve dissolution for peptides that are hydrophobic, aggregation-prone, or protein-like in structure.</p>
          <p>Acetic acid is not required for most peptides and should be considered a compound-specific exception, rather than a routine default.</p>
        </DilutionSection>

        <DilutionSection title="How to Use the Dilution Table">
          <p>The dilution table below provides guidance on the recommended starting diluent for each peptide:</p>
          <ul className="dilution-key-list">
            <li><strong>BAC</strong><span><a href="https://purehealthpeptides.com/product/bacteriostatic-water/">Bacteriostatic water</a> is preferred for routine reconstitution.</span></li>
            <li><strong>BAC*</strong><span>Bacteriostatic water is preferred, but the compound may show solubility variability or sensitivity depending on batch consistency or handling. Additional care is recommended.</span></li>
            <li><strong>Acetic Acid</strong><span>Acetic acid is commonly preferred for initial reconstitution due to known solubility or stability characteristics.</span></li>
          </ul>
        </DilutionSection>

        <DilutionSection title="Best Practices (General Handling Reference)">
          <p>Research focused on immune modulation, inflammatory signaling, and host-defense pathways. This area examines peptides studied for their interaction with innate and adaptive immune systems.</p>
          <ul>
            <li>Use appropriate laboratory technique when working with peptides and diluents</li>
            <li>Store reconstituted solutions according to standard research handling practices</li>
            <li>Minimize exposure to air and contaminants</li>
            <li>Clearly label solutions with preparation date and diluent used</li>
          </ul>
        </DilutionSection>

        <DilutionSection title="Commitment to Research Quality">
          <p>Pure Health Peptides is committed to providing high-purity research compounds and supporting materials with transparency and consistency.<br />All products are offered for research use only and are not intended for human or animal use.</p>
        </DilutionSection>

        <button className="dilution-chart-button" type="button" onClick={() => setChartOpen(true)} aria-label="Open dilution recommendation chart">
          <img src="/assets/peptide-info/dilution-guide.svg" alt="COMPACT ReSeARCH DILUTION ReCOMMeNDATION GUIDe" />
        </button>

        <section className="dilution-faqs">
          <h2>Frequently Asked Questions (Dilution Guide)</h2>
          {dilutionFaqs.map((faq) => (
            <article key={faq.question}>
              <h4>{faq.question}</h4>
              <p>{faq.answer}</p>
            </article>
          ))}
          <p className="dilution-final-note">This guide reflects general research handling practices and does not replace laboratory-specific protocols</p>
        </section>
      </div>

      {chartOpen && (
        <div ref={dialogRef} className="dilution-lightbox" role="dialog" aria-modal="true" aria-label="Dilution recommendation chart" tabIndex="-1">
          <button className="dilution-lightbox-backdrop" type="button" tabIndex="-1" aria-label="Close chart" onClick={() => setChartOpen(false)} />
          <button ref={closeButtonRef} className="dilution-lightbox-close" type="button" aria-label="Close chart" onClick={() => setChartOpen(false)}><X /></button>
          <div className="dilution-lightbox-image">
            <img src="/assets/peptide-info/dilution-guide.svg" alt="COMPACT ReSeARCH DILUTION ReCOMMeNDATION GUIDe" />
          </div>
        </div>
      )}
    </div>
  )
}
