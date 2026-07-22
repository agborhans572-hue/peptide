import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Info, Minus, Plus } from 'lucide-react'
import { shopProducts } from './catalog.js'
import { productPath } from './productRoutes.js'
import { dimensionsLabel, formatCents, restrictionLabels, stockLabel } from './money.js'
import { responsiveImageProps } from './productImages.js'
import './productDetail.css'

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function priceForQuantity(product, unitPrice, quantity) {
  const subtotal = roundMoney(unitPrice * quantity)
  if (quantity < 2) return subtotal

  if (product?.discountRule === 2) {
    const discountPercent = quantity === 2 ? 5 : 7.5
    return roundMoney(roundMoney(unitPrice * (1 - discountPercent / 100)) * quantity)
  }

  return roundMoney(subtotal * (1 - Math.min(quantity, 15) / 100))
}

function optionLabel(option, index) {
  return String(option?.label ?? option?.name ?? `Option ${index + 1}`)
}

function optionPrice(option, product) {
  const parsed = Number.parseFloat(Number.isInteger(option?.priceCents) ? option.priceCents / 100 : option?.price ?? product?.price ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function optionAvailable(option, product) {
  return !product?.comingSoon && option?.available !== false && Number(option?.maxQty ?? 1) !== 0
}

function optionMax(option) {
  const parsed = Number.parseInt(option?.maxQty, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 999
}

function usageNotice() {
  return 'Pure Health Peptides products are supplied to qualified research professionals and institutional users for in vitro laboratory research only. KYC verification is required prior to order fulfillment, and we reserve the right to refuse orders that do not meet buyer qualification criteria. These products are not drugs, foods, cosmetics, diagnostic products, or dietary supplements, have not been evaluated by the FDA, and are not intended for human or animal use. Any such use is prohibited and may violate federal, state, or local law. By purchasing, the buyer represents and warrants that the product will be used solely for in vitro research. The buyer agrees to indemnify, defend, and hold harmless Pure Health Peptides, its officers, employees, and agents from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys fees) arising out of or relating to the buyer’s use, handling, storage, or disposition of the product in any manner inconsistent with its research-use-only designation or applicable law.'
}

function descriptionWithMolecularControls(html, hasMolecularStructure) {
  if (!hasMolecularStructure || !html) return html
  return html.replace(
    /(<div class="molecular-structure-img-wrap">[\s\S]*?<\/div>)/i,
    `$1
      <div class="molecular-structure-controls" aria-label="Molecular structure viewer controls">
        <button type="button" data-molecular-action="reset" aria-label="Reset molecular structure view">↺</button>
        <button type="button" data-molecular-action="zoom-in" aria-label="Zoom in molecular structure">+</button>
        <button type="button" data-molecular-action="zoom-out" aria-label="Zoom out molecular structure">−</button>
        <button type="button" data-molecular-action="fullscreen" aria-label="View molecular structure fullscreen">⛶</button>
      </div>`,
  )
}

export function ProductDetailPage({ product, detail, onAddToCart, onNavigate, onProduct }) {
  const options = useMemo(() => Array.isArray(product?.options) ? product.options : [], [product])
  const [optionIndex, setOptionIndex] = useState(product?.defaultOption || 0)
  const [quantity, setQuantity] = useState(1)
  const [galleryIndex, setGalleryIndex] = useState(0)

  useEffect(() => {
    setOptionIndex(product?.defaultOption || 0)
    setQuantity(1)
    setGalleryIndex(0)
  }, [product])

  const option = options[optionIndex] || null
  const price = optionPrice(option, product)
  const totalPrice = priceForQuantity(product, price, quantity)
  const available = optionAvailable(option, product)
  const maxQuantity = optionMax(option)
  const gallery = detail?.images?.length
    ? detail.images
    : [{ role: 'primary', src: product.image, alt: product.name }]
  const renderedDescription = descriptionWithMolecularControls(
    detail?.descriptionHtml || `<p>${usageNotice()}</p>`,
    Boolean(detail?.molecularStructureImage),
  )
  const galleryHeightOffset = {
    vials: 98,
    capsules: 67,
    liquids: 187,
    topicals: 32,
  }[product.type] || 98
  const desktopGalleryHeight = Math.max(3, gallery.length) * 525 + galleryHeightOffset
  const allOptionsUnavailable = options.length === 0 || options.every((item) => !optionAvailable(item, product))
  const coaDestination = {
    vials: { route: 'coaVials', path: '/coa-library/vials/' },
    capsules: { route: 'coaCapsules', path: '/coa-library/capsules/' },
    liquids: { route: 'coaLiquids', path: '/coa-library/liquids/' },
    topicals: { route: 'coaTopicals', path: '/coa-library/topicals/' },
  }[product.type]
  const optionPrompt = product.type === 'capsules' || product.type === 'liquids' ? 'Select Volume' : 'Select Weight'
  const relatedProducts = useMemo(() => {
    const currentCategories = new Set(Array.isArray(product?.categories) ? product.categories : [])
    return shopProducts
      .filter((candidate) => candidate.id !== product?.id)
      .map((candidate) => ({
        candidate,
        score:
          (candidate.type === product?.type ? 12 : 0) +
          (candidate.categories || []).filter((category) => currentCategories.has(category)).length * 5 +
          Math.min(Number(candidate.popularity || 0) / 5000, 2),
      }))
      .sort((left, right) => right.score - left.score || Number(right.candidate.popularity || 0) - Number(left.candidate.popularity || 0))
      .slice(0, 4)
      .map(({ candidate }) => candidate)
  }, [product])

  function changeOption(index) {
    setOptionIndex(index)
    setQuantity(1)
    setGalleryIndex(0)
  }

  function addProduct() {
    if (!available) return
    onAddToCart({ product, option, quantity, unitPrice: price, maxQty: maxQuantity })
  }

  function handleDescriptionClick(event) {
    const control = event.target.closest('[data-molecular-action]')
    if (!control) return
    const viewer = control.closest('.molecular-structure-wrap')
    const image = viewer?.querySelector('.molecular-structure-img')
    if (!viewer || !image) return

    const action = control.dataset.molecularAction
    if (action === 'fullscreen') {
      const fullscreenRequest = document.fullscreenElement
        ? document.exitFullscreen?.()
        : viewer.requestFullscreen?.()
      fullscreenRequest?.catch?.(() => {})
      return
    }

    const currentZoom = Number.parseFloat(image.dataset.zoom || '1')
    const nextZoom = action === 'reset'
      ? 1
      : action === 'zoom-in'
        ? Math.min(2.5, currentZoom + 0.25)
        : Math.max(0.5, currentZoom - 0.25)
    image.dataset.zoom = String(nextZoom)
    image.style.transform = `scale(${nextZoom})`
  }

  function followRoute(event, route) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(route)
  }

  return (
    <div className={`product-detail-page product-detail-${product.type}`}>
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <a href="/" onClick={(event) => followRoute(event, 'home')}>Home</a>
        <span aria-hidden="true">/</span>
        <a href="/shop/" onClick={(event) => followRoute(event, 'shop')}>Research Peptides</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>
      <section
        className="product-detail-hero"
        style={{ '--product-gallery-height': `${desktopGalleryHeight}px` }}
      >
        <div className="product-gallery product-gallery-desktop">
          <div className="product-gallery-thumbs">
            {gallery.map((image, index) => (
              <button className={galleryIndex === index ? 'active' : ''} type="button" aria-pressed={galleryIndex === index} onClick={() => setGalleryIndex(index)} key={`${image.src}-${index}`}>
                <img src={image.src} alt={image.alt || `${product.name} gallery image ${index + 1}`} />
              </button>
            ))}
          </div>
          <div className="product-gallery-main">
            <img
              {...responsiveImageProps(galleryIndex === 0 ? (option?.image || gallery[0]?.src || product.image) : gallery[galleryIndex]?.src, '(max-width: 800px) 94vw, 50vw')}
              alt={galleryIndex === 0 ? (option?.imageAlt || gallery[0]?.alt || product.imageAlt || product.name) : (gallery[galleryIndex]?.alt || product.name)}
              decoding="async"
            />
          </div>
        </div>

        <div className="product-gallery product-gallery-mobile">
          <div className="product-gallery-mobile-main">
            {gallery.map((image, index) => <img src={image.src} alt={image.alt || `${product.name} gallery image ${index + 1}`} key={`${image.src}-${index}`} />)}
          </div>
          <div className="product-gallery-mobile-thumbnails" aria-hidden="true">
            {gallery.map((image, index) => <img src={image.src} alt="" key={`mobile-thumb-${image.src}-${index}`} />)}
          </div>
        </div>

        <div className="product-purchase-panel">
          <p className="product-detail-categories">{detail?.categories?.map((category) => category.name).join(', ') || 'Research Product'}</p>
          <h1>{detail?.title || product.name}</h1>
          <div className="product-short-description" dangerouslySetInnerHTML={{ __html: detail ? detail.shortDescriptionHtml : `<p>${product.name} is supplied for controlled in-vitro laboratory research.</p>` }} />

          <div className="product-buy-controls">
            <label>
              <span>{optionPrompt}</span>
              <select value={optionIndex} disabled={allOptionsUnavailable} onChange={(event) => changeOption(Number(event.target.value))}>
                {options.map((item, index) => (
                  <option value={index} disabled={!optionAvailable(item, product)} key={`${optionLabel(item, index)}-${index}`}>
                    {optionLabel(item, index)}{!optionAvailable(item, product) ? ' — unavailable' : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="product-detail-amount" role="group" aria-labelledby={`product-amount-${product.id}`}>
              <span id={`product-amount-${product.id}`}>Select Amount</span>
              <div>
                <button type="button" aria-label="Decrease quantity" disabled={!available || quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus /></button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={maxQuantity}
                  value={quantity}
                  disabled={!available}
                  aria-label={`${product.name} quantity`}
                  onChange={(event) => setQuantity(Math.min(maxQuantity, Math.max(1, Number.parseInt(event.target.value, 10) || 1)))}
                />
                <button type="button" aria-label="Increase quantity" disabled={!available || quantity >= maxQuantity} onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}><Plus /></button>
              </div>
            </div>
          </div>

          <div className="product-detail-price-row">
            <strong aria-live="polite">
              {option?.compareAtPriceCents > option?.priceCents && <del>{formatCents(option.compareAtPriceCents * quantity)}</del>}
              {formatCents(Math.round(totalPrice * 100), product.currency)}
            </strong>
            <span>Order More, Save More</span>
          </div>
          <dl className="product-variant-facts" aria-live="polite">
            <div><dt>SKU</dt><dd>{option?.sku || product.sku}</dd></div>
            <div><dt>Availability</dt><dd>{stockLabel(option)}</dd></div>
            <div><dt>Package</dt><dd>{dimensionsLabel(option)}</dd></div>
            <div><dt>Shipping restrictions</dt><dd>{restrictionLabels(option).join(' · ') || 'No listed restrictions'}</dd></div>
          </dl>
          <button className="product-detail-add" type="button" disabled={!available} onClick={addProduct}>
            {available ? 'ADD TO CART' : 'OUT OF STOCK'}
          </button>
          <p className="product-detail-shipping"><BadgeCheck /> Free Shipping on All Orders $175+</p>
        </div>
      </section>

      <aside className="product-usage-notice">
        <p><Info aria-hidden="true" /><strong>Product Usage:</strong> Not for Human or Veterinary Use</p>
        <span>{usageNotice()}</span>
      </aside>

      <section className="product-technical-panel">
        <div>
          <section className={`product-technical-description template-${detail?.contentTemplate || 'structured'}`}>
            <h2>Description</h2>
            <div className="product-description-html" onClick={handleDescriptionClick} dangerouslySetInnerHTML={{ __html: renderedDescription }} />
          </section>

          <section className="product-coa-callout">
            <img src="/assets/product-detail/coa-illustration.png" alt="Certificate of Analysis documentation" />
            <div>
              <h2>Certificate of Analysis</h2>
              <p>At Pure Health Peptides, transparency is key. Every batch is third-party tested in the USA, with Certificates of Analysis (COAs) readily available for verification, giving researchers confidence in their work.</p>
              <a
                href={coaDestination.path}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  onNavigate(coaDestination.route)
                }}
              >VIEW CERTIFICATIONS</a>
            </div>
          </section>
        </div>
      </section>

      <section className="product-related-products" aria-labelledby="related-products-title">
        <p className="eyebrow">CONTINUE EXPLORING</p>
        <h2 id="related-products-title">Related research materials</h2>
        <div className="product-related-grid">
          {relatedProducts.map((relatedProduct) => (
            <a
              href={productPath(relatedProduct)}
              onClick={(event) => {
                if (!onProduct || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                onProduct(relatedProduct)
              }}
              key={relatedProduct.id}
            >
              <img src={relatedProduct.image} alt={`${relatedProduct.name} research ${relatedProduct.type}`} loading="lazy" />
              <span>{relatedProduct.type}</span>
              <h3>{relatedProduct.name}</h3>
              <p>From {formatCents(relatedProduct.priceCents, relatedProduct.currency)}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

export function ProductNotFoundPage({ onShop }) {
  return (
    <section className="product-not-found">
      <p className="eyebrow">PRODUCT NOT FOUND</p>
      <h1>This research product is unavailable.</h1>
      <p>The link may be outdated, or the product may no longer be part of the active catalog.</p>
      <button className="button button-primary" type="button" onClick={onShop}>RETURN TO SHOP</button>
    </section>
  )
}
