import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { appPath } from './appPath.js'
import { catalogVersion } from './catalog.js'
import './coaLibrary.css'

const carriers = [
  { key: 'vials', label: 'Vial COAs', route: 'coaVials' },
  { key: 'capsules', label: 'Capsule COAs', route: 'coaCapsules' },
  { key: 'liquids', label: 'Liquid COAs', route: 'coaLiquids' },
  { key: 'topicals', label: 'Topical COAs', route: 'coaTopicals' },
]

const trustCards = [
  {
    icon: 'trust-1.svg',
    title: 'Independence eliminates conflict of interest',
    copy: 'A supplier that tests its own products has every commercial incentive to report favorably on them. An independent lab has the opposite incentive — its credibility, and therefore its ability to operate, depends on its results being reliable regardless of who pays for the test.',
  },
  {
    icon: 'trust-2.svg',
    title: 'Accredited methods deliver reproducible results',
    copy: 'The labs we work with operate under recognized analytical chemistry standards using calibrated instrumentation and validated methods. The same sample, tested twice, should yield the same answer.',
  },
  {
    icon: 'trust-3.svg',
    title: 'Documentation that travels',
    copy: 'A COA from a recognized independent laboratory is documentation a researcher can rely on, present to a peer reviewer, or use as part of a published methods section. A self-issued certificate carries none of that weight.',
  },
]

const coaFaqs = [
  {
    question: 'Where is my batch ID printed?',
    answer: 'The batch ID is printed vertically along the side of the product label. The same identifier appears on the COA. If your product label is damaged or unreadable, contact us at info@purehealthpeptidesshop.com with a photo of your product and we’ll help locate the matching COA.',
  },
  {
    question: 'Why is my batch ID not in the list?',
    answer: 'All in-distribution batches should appear in the library. If yours doesn’t, the most likely reasons are: (1) the batch is older than the current indexing window, (2) there is a data-entry delay between manufacture and library publication, or (3) the batch ID has been transcribed slightly differently. In all cases, please contact us with a clear photo of your label and we will provide the COA directly.',
  },
  {
    question: 'Can I download the COA PDF?',
    answer: 'Yes. When you click your matching batch ID, the COA opens in a new browser tab as a standard PDF. From there you can view, download, save, print, or share the file. The PDF is unwatermarked and unrestricted.',
  },
  {
    question: 'Why does my COA show a purity of 99.82% rather than the ≥99% I see on the product page?',
    answer: 'The product page lists the minimum specification — the floor every batch must meet. The COA reports the actual measured result for the specific batch you received, which will typically exceed the specification. A spec of “≥99%” with a result of “99.82%” means your batch is well above the minimum.',
  },
  {
    question: 'Are these COAs issued by Pure Health Peptides or by an independent lab?',
    answer: 'Every COA is issued by an independent third-party analytical laboratory. Pure Health Peptides does not perform its own testing. Our primary testing partner is Ethos Analytics, an ISO/IEC 17025-accredited laboratory; earlier COAs in the Library may be issued by BioRegen or other prior testing partners. The lab is identified on each COA. We send samples to the lab, the lab analyzes them and issues the certificate, and we publish those certificates to you unaltered.',
  },
  {
    question: 'My product label has a single QR code — does it work for all carrier types?',
    answer: 'Yes. Every Pure Health Peptides product — vials, capsules, liquids, and topical systems — uses the same universal QR code. The QR code points to this COA Library landing page, where you select your carrier type to begin the lookup.',
  },
  {
    question: 'What if the same batch ID appears under multiple sizes (for example, 5 mg and 10 mg)?',
    answer: 'Some batches are filled into multiple presentation sizes from the same production lot. Where this is the case, the size is appended to the batch ID button (e.g. “SYN-030926 (10 mg)” vs “SYN-030926 (5 mg)”) so you can match the exact presentation you received.',
  },
  {
    question: 'Do your COAs include endotoxin and microbial limits testing?',
    answer: 'Yes. As of May 2026, our standard COA panel includes five tests: identity, purity, quantity, endotoxin, and microbial limits. The first three address the peptide itself — the result of the chemical synthesis step. The last two address the supply chain that delivers the product to your hand, since environmental contamination can theoretically enter through downstream handling, lyophilization, vial filling, storage, or transit. Earlier COAs in the Library may reflect our earlier three-test panel; we preserve those records unchanged because record integrity matters. See “Why we test for endotoxin and microbial limits” above for the full explanation.',
  },
  {
    question: "Can I verify a COA's authenticity directly with the laboratory?",
    answer: 'Yes. Each COA carries the issuing laboratory’s contact information and a unique COA reference number. You can contact the lab directly to verify that the COA was issued by them.',
  },
]

function CarrierButtons({ onNavigate, compact = false }) {
  return (
    <div className={`coa-carrier-buttons${compact ? ' coa-carrier-buttons-compact' : ''}`}>
      {carriers.map((carrier) => (
        <button className={`coa-carrier-button carrier-${carrier.key}`} type="button" onClick={() => onNavigate(carrier.route)} key={carrier.key}>
          {carrier.label}
        </button>
      ))}
    </div>
  )
}

export function CoaLibraryPage({ onNavigate }) {
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <div className="coa-library-page">
      <section className="coa-library-hero">
        <div>
          <h1>Certificate Of Analysis (COA) LiBrary</h1>
          <p>Find your product’s testing results in just a few clicks.<br />Select your product, match the batch ID, and instantly access the corresponding Certificate of Analysis.</p>
          <CarrierButtons onNavigate={onNavigate} />
        </div>
      </section>

      <section className="coa-how-section">
        <div className="coa-how-images">
          {[1, 2, 3, 4].map((number) => <img src={`/assets/coa-library/how-${number}.png`} alt={`How to locate a Certificate of Analysis step ${number}`} key={number} />)}
        </div>
        <div className="coa-how-copy">
          <h2>HOW TO FIND YOUR COA?</h2>
          <p><strong>A Certificate of Analysis (COA) provides batch-specific verification of a product’s identity, composition, and quality.</strong></p>
          <ol>
            <li>Select your carrier type — vials, capsules, liquids, or topical systems.</li>
            <li>Identify your product — find your product by name (for example, BPC-157, Cartalax, DSIP).</li>
            <li>Match your batch ID — locate the batch ID printed vertically along the side of the product label.</li>
            <li>Open the COA — click the matching batch ID button to view, download, or share the certificate of analysis. The COA opens in a new browser tab as a PDF.</li>
          </ol>
        </div>
      </section>

      <section className="coa-choose-section">
        <h2>ChOOse yOur carrier type</h2>
        <CarrierButtons onNavigate={onNavigate} compact />
      </section>

      <section className="coa-trust-section">
        <h2>Why every batch is testeD</h2>
        <p>Pure Health Peptides does not test its own products. Every Certificate of Analysis you receive from us is issued by an independent third-party laboratory with its own accreditations, its own analytical staff, and its own commercial reputation to protect.</p>
        <div className="coa-trust-grid">
          {trustCards.map((card) => (
            <article key={card.title}>
              <img src={`/assets/coa-library/${card.icon}`} alt="" />
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="coa-library-faqs">
        <h2>Frequently asked questions</h2>
        <div>
          {coaFaqs.map((faq, index) => {
            const open = openFaq === index
            return (
              <article className={open ? 'is-open' : ''} key={faq.question}>
                <button type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? -1 : index)}>
                  <span><strong>{String(index + 1).padStart(2, '0')}</strong>{faq.question}</span>
                  <ChevronDown />
                </button>
                <div><p>{faq.answer}</p></div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function SearchGroup({ label, placeholder, value, onChange, onSearch }) {
  return (
    <label className="coa-search-group">
      <span>{label}</span>
      <span className="coa-search-control">
        <input
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') onSearch() }}
        />
        <button type="button" onClick={onSearch}>SEARCH</button>
      </span>
    </label>
  )
}

function BatchLinks({ category, item, batchFilter }) {
  const [expanded, setExpanded] = useState(false)
  const [batches, setBatches] = useState(null)
  const [failed, setFailed] = useState(false)

  async function toggle() {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (batches || failed) return
    try {
      const response = await fetch(appPath(`/coa/${catalogVersion}/${category}/products/${item.id}.json`), { cache: 'force-cache' })
      if (!response.ok) throw new Error(`COA request failed with ${response.status}.`)
      const document = await response.json()
      setBatches(Array.isArray(document.batches) ? document.batches : [])
    } catch {
      setFailed(true)
    }
  }

  const visibleBatches = (batches || []).filter((batch) => (
    !batchFilter || batch.id.toLowerCase().includes(batchFilter.toLowerCase())
  ))
  return (
    <div className="coa-batch-links">
      <button type="button" aria-expanded={expanded} onClick={toggle}>
        {expanded ? 'Hide batches' : `View ${item.batchCount} ${item.batchCount === 1 ? 'batch' : 'batches'}`}
      </button>
      {expanded && !batches && !failed && <span role="status">Loading…</span>}
      {expanded && failed && <span role="alert">Batch links are temporarily unavailable.</span>}
      {expanded && visibleBatches.map((batch, index) => (
        <a href={batch.href} target="_blank" rel="noreferrer" key={`${batch.id}-${index}`}>{batch.id}</a>
      ))}
    </div>
  )
}

export function CoaCategoryPage({ category }) {
  const [page, setPage] = useState(null)
  const [pageFailed, setPageFailed] = useState(false)
  const [productInput, setProductInput] = useState('')
  const [batchInput, setBatchInput] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [visibleCount, setVisibleCount] = useState(24)

  useEffect(() => {
    const controller = new AbortController()
    setPage(null)
    setPageFailed(false)
    fetch(appPath(`/coa/${catalogVersion}/${category}/index.json`), { cache: 'force-cache', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`COA index request failed with ${response.status}.`)
        return response.json()
      })
      .then(setPage)
      .catch((error) => { if (error.name !== 'AbortError') setPageFailed(true) })
    return () => controller.abort()
  }, [category])

  if (pageFailed) return <div className="route-loader" role="alert">The COA library is temporarily unavailable.</div>
  if (!page) return <div className="route-loader" role="status">Loading COA library…</div>

  const filteredItems = page.items.filter((item) => {
    const productMatch = !productFilter || item.product.toLowerCase().includes(productFilter.toLowerCase())
    const batchMatch = !batchFilter || item.batchIds.some((batchId) => batchId.toLowerCase().includes(batchFilter.toLowerCase()))
    return productMatch && batchMatch
  })
  const hasFilter = Boolean(productFilter || batchFilter)
  const visibleItems = filteredItems.slice(0, visibleCount)

  function clearFilters() {
    setProductInput('')
    setBatchInput('')
    setProductFilter('')
    setBatchFilter('')
    setVisibleCount(24)
  }

  return (
    <div className={`coa-category-page coa-category-${category}`}>
      <h1>{page.heading}</h1>
      <div className="coa-search-grid">
        <SearchGroup label="Search by Product Name:" placeholder="Product Name" value={productInput} onChange={setProductInput} onSearch={() => { setProductFilter(productInput.trim()); setVisibleCount(24) }} />
        <SearchGroup label="Search by Batch ID:" placeholder="Batch ID" value={batchInput} onChange={setBatchInput} onSearch={() => { setBatchFilter(batchInput.trim()); setVisibleCount(24) }} />
      </div>
      {hasFilter && <button className="coa-clear-filter" type="button" onClick={clearFilters}>CLEAR <span>×</span></button>}
      <p className="coa-results-count">Showing {visibleItems.length} of {filteredItems.length} results</p>
      <div className="coa-results-grid">
        {visibleItems.map((item) => (
          <article className="coa-result-card" key={item.product}>
            <h2>{item.product}</h2>
            <div>
              <strong>Batch ID:</strong>
              <BatchLinks category={category} item={item} batchFilter={batchFilter} />
            </div>
          </article>
        ))}
      </div>
      {visibleCount < filteredItems.length && (
        <button className="coa-clear-filter" type="button" onClick={() => setVisibleCount((count) => count + 24)}>LOAD MORE RESULTS</button>
      )}
    </div>
  )
}
