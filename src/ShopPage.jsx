import { useEffect, useMemo, useState } from 'react'
import { RESEARCH_CATEGORIES, SHOP_TYPES } from './shopData.js'
import { shopProducts } from './catalog.js'
import { productPath } from './productRoutes.js'
import { dimensionsLabel, formatCents, restrictionLabels, stockLabel } from './money.js'
import { responsiveImageProps } from './productImages.js'
import './shop.css'

const SECTION_ORDER = ['Vials', 'Capsules', 'Liquids', 'Topicals']
const SIDEBAR_ORDER = ['Topicals', 'Capsules', 'Liquids', 'Vials']
const JUMP_ORDER = ['Topicals', 'ALL', 'Vials', 'Capsules', 'Liquids']

const SORT_OPTIONS = [
  { value: 'default', label: 'Select Filter' },
  { value: 'popularity', label: 'Sort by popularity' },
  { value: 'latest', label: 'Sort by latest' },
  { value: 'price-asc', label: 'Sort by price: low to high' },
  { value: 'price-desc', label: 'Sort by price: high to low' },
  { value: 'title-asc', label: 'Sort by title (A-Z)' },
  { value: 'title-desc', label: 'Sort by title (Z-A)' },
]

const titleCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
})

function normalizedToken(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase()
}

function choiceTokens(choice) {
  if (choice == null) return []
  if (typeof choice !== 'object') return [normalizedToken(choice)]

  return [choice.id, choice.value, choice.key, choice.label, choice.name, choice.title]
    .map(normalizedToken)
    .filter(Boolean)
}

function choiceLabel(choice) {
  if (choice == null) return ''
  if (typeof choice !== 'object') return String(choice)
  return String(choice.label ?? choice.name ?? choice.title ?? choice.value ?? choice.id ?? '')
}

function choiceValue(choice) {
  return choiceTokens(choice)[0] || normalizedToken(choiceLabel(choice))
}

const typeChoices = Array.isArray(SHOP_TYPES) ? SHOP_TYPES : []

function typeTokensForLabel(label) {
  const normalizedLabel = normalizedToken(label)
  const matchingChoice = typeChoices.find((choice) => choiceTokens(choice).includes(normalizedLabel))
  return new Set([normalizedLabel, ...choiceTokens(matchingChoice)])
}

function productMatchesType(product, typeLabel) {
  const expectedTokens = typeTokensForLabel(typeLabel)
  return choiceTokens(product.type).some((token) => expectedTokens.has(token))
}

const researchChoices = [
  { label: 'ALL', value: 'all', tokens: new Set(['all']) },
  ...(Array.isArray(RESEARCH_CATEGORIES) ? RESEARCH_CATEGORIES : [])
    .filter((choice) => !choiceTokens(choice).includes('all'))
    .map((choice) => ({
      label: choiceLabel(choice),
      value: choiceValue(choice),
      tokens: new Set(choiceTokens(choice)),
    })),
]

function productMatchesResearchCategory(product, selectedCategory) {
  if (selectedCategory === 'all') return true

  const selectedChoice = researchChoices.find((choice) => choice.value === selectedCategory)
  if (!selectedChoice) return true

  const productCategories = Array.isArray(product.categories)
    ? product.categories
    : [product.categories]

  return productCategories.some((category) =>
    choiceTokens(category).some((token) => selectedChoice.tokens.has(token)),
  )
}

function numericValue(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function productSortPrice(product) {
  return numericValue(product.sortPrice, numericValue(product.price))
}

function sortProducts(products, sortBy) {
  return [...products].sort((left, right) => {
    switch (sortBy) {
      case 'latest':
        return (
          numericValue(right.latestOrder) - numericValue(left.latestOrder) ||
          numericValue(right.order) - numericValue(left.order)
        )
      case 'price-asc':
        return productSortPrice(left) - productSortPrice(right)
      case 'price-desc':
        return productSortPrice(right) - productSortPrice(left)
      case 'title-asc':
        return titleCollator.compare(left.name, right.name)
      case 'title-desc':
        return titleCollator.compare(right.name, left.name)
      case 'popularity':
        return (
          numericValue(right.popularity) - numericValue(left.popularity) ||
          numericValue(left.order) - numericValue(right.order)
        )
      case 'default':
      default:
        return numericValue(left.order) - numericValue(right.order)
    }
  })
}

function domId(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function productDomId(product) {
  return `shop-product-${domId(product.id || product.name)}`
}

function sectionDomId(type) {
  return `shop-type-${domId(type)}`
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizedOptions(product) {
  if (Array.isArray(product.options)) return product.options
  if (!product.options || typeof product.options !== 'object') return []

  return Object.entries(product.options).map(([label, price]) => ({ label, price }))
}

function productMatchesSearch(product, query) {
  const normalizedQuery = normalizedToken(query)
  if (!normalizedQuery) return true

  const searchableValues = [
    product.name,
    ...normalizedOptions(product).map((option, index) => optionLabel(option, index)),
  ]

  return searchableValues.some((value) => normalizedToken(value).includes(normalizedQuery))
}

function optionLabel(option, index) {
  if (typeof option !== 'object' || option == null) return String(option)
  return String(
    option.label ??
      option.name ??
      option.title ??
      option.value ??
      option.weight ??
      option.volume ??
      option.size ??
      `Option ${index + 1}`,
  )
}

function optionPrice(option, product) {
  if (option && typeof option === 'object') {
    const candidate = Number.isInteger(option.priceCents) ? option.priceCents / 100 : option.price ?? option.unitPrice ?? option.sortPrice
    const parsedCandidate = numericValue(candidate, Number.NaN)
    if (Number.isFinite(parsedCandidate)) return parsedCandidate
  }

  return numericValue(product.price, productSortPrice(product))
}

function optionPriceCents(option, product) {
  if (Number.isInteger(option?.priceCents)) return option.priceCents
  if (Number.isInteger(product?.priceCents)) return product.priceCents
  return Math.round(optionPrice(option, product) * 100)
}

function optionIsAvailable(option, product) {
  if (product.comingSoon) return false
  if (option && typeof option === 'object' && 'available' in option) {
    return option.available !== false
  }
  return true
}

function optionMaxQuantity(option, product) {
  const candidate =
    option && typeof option === 'object' && 'maxQty' in option
      ? option.maxQty
      : product.maxQty
  const parsed = numericValue(candidate, Number.NaN)

  // A null stock cap represents an unlimited WooCommerce variant.
  if (!Number.isFinite(parsed)) return 999
  return Math.max(0, Math.floor(parsed))
}

function defaultOptionIndex(product, options) {
  if (options.length === 0) return 0

  const requested = product.defaultOption
  const numericIndex = Number(requested)
  if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < options.length) {
    return numericIndex
  }

  if (requested != null) {
    const requestedLabel = normalizedToken(
      typeof requested === 'object' ? optionLabel(requested, 0) : requested,
    )
    const matchingIndex = options.findIndex(
      (option, index) => normalizedToken(optionLabel(option, index)) === requestedLabel,
    )
    if (matchingIndex >= 0) return matchingIndex
  }

  const firstAvailableIndex = options.findIndex(
    (option) => optionIsAvailable(option, product) && optionMaxQuantity(option, product) > 0,
  )
  return firstAvailableIndex >= 0 ? firstAvailableIndex : 0
}

function discountTotals(product, quantity, unitPrice) {
  const subtotal = roundCurrency(unitPrice * quantity)
  const rule = numericValue(product.discountRule, 1)

  if (rule === 2) {
    const discountPercent = quantity >= 3 ? 7.5 : quantity === 2 ? 5 : 0
    const discountedUnitPrice = roundCurrency(unitPrice * (1 - discountPercent / 100))
    const total = roundCurrency(discountedUnitPrice * quantity)

    return {
      discountPercent,
      discountedUnitPrice,
      subtotal,
      savings: roundCurrency(Math.max(0, subtotal - total)),
      total,
    }
  }

  const discountPercent = quantity >= 2 ? Math.min(quantity, 15) : 0
  const total = roundCurrency(subtotal * (1 - discountPercent / 100))

  return {
    discountPercent,
    discountedUnitPrice: roundCurrency(unitPrice * (1 - discountPercent / 100)),
    subtotal,
    savings: roundCurrency(Math.max(0, subtotal - total)),
    total,
  }
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function ProductCard({ product, onAddToCart, onLearnMore }) {
  const options = useMemo(() => normalizedOptions(product), [product])
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(() =>
    defaultOptionIndex(product, options),
  )
  const [quantity, setQuantity] = useState(1)

  const option = options[selectedOptionIndex] ?? null
  const unitPrice = optionPrice(option, product)
  const unitPriceCents = optionPriceCents(option, product)
  const maxQty = optionMaxQuantity(option, product)
  const optionAvailable = optionIsAvailable(option, product) && maxQty > 0
  const { discountPercent, savings, total } = discountTotals(product, quantity, unitPrice)
  const productId = productDomId(product)
  const optionSelectId = `${productId}-option`

  function changeQuantity(change) {
    if (!optionAvailable) return
    setQuantity((current) => Math.min(maxQty, Math.max(1, current + change)))
  }

  function selectOption(index) {
    const nextOption = options[index]
    const nextMaxQty = optionMaxQuantity(nextOption, product)
    setSelectedOptionIndex(index)
    setQuantity((current) => Math.min(Math.max(nextMaxQty, 1), current))
  }

  function addToCart() {
    onAddToCart?.({
      product,
      option,
      quantity,
      unitPrice,
      maxQty,
      total,
      savings,
    })
  }

  return (
    <article className="shop-card" id={productId}>
      <h3 className="sr-only">{product.name}</h3>
      <div className="shop-card-image">
        <img {...responsiveImageProps(option?.image || product.image, '(max-width: 720px) 92vw, 330px')} alt={option?.imageAlt || product.imageAlt || `${product.name} product`} loading="lazy" decoding="async" />
      </div>

      <div className="shop-card-form">
        {options.length > 0 && (
          <div className="shop-variant-row">
            <label htmlFor={optionSelectId}>Select {product.optionLabel || 'Option'}</label>
            <select
              className="shop-select"
              id={optionSelectId}
              value={selectedOptionIndex}
              disabled={options.every(
                (item) => !optionIsAvailable(item, product) || optionMaxQuantity(item, product) < 1,
              )}
              onChange={(event) => selectOption(Number(event.target.value))}
            >
              {options.map((item, index) => (
                <option
                  value={index}
                  disabled={
                    !optionIsAvailable(item, product) || optionMaxQuantity(item, product) < 1
                  }
                  key={`${optionLabel(item, index)}-${index}`}
                >
                  {optionLabel(item, index)}
                  {!optionIsAvailable(item, product) || optionMaxQuantity(item, product) < 1
                    ? ' — unavailable'
                    : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="shop-variant-row">
          <span id={`${productId}-quantity-label`}>Select Amount</span>
          <div className="shop-quantity" aria-labelledby={`${productId}-quantity-label`}>
            <button
              className="shop-qty-btn"
              type="button"
              aria-label={`Decrease ${product.name} quantity`}
              disabled={!optionAvailable || quantity === 1}
              onClick={() => changeQuantity(-1)}
            >
              −
            </button>
            <output className="shop-qty-value" aria-live="polite">
              {quantity}
            </output>
            <button
              className="shop-qty-btn"
              type="button"
              aria-label={`Increase ${product.name} quantity`}
              disabled={!optionAvailable || quantity >= maxQty}
              onClick={() => changeQuantity(1)}
            >
              +
            </button>
          </div>
        </div>

        <div className="shop-price-row">
          <span className="shop-price">
            {option?.compareAtPriceCents > unitPriceCents && <del>{formatCents(option.compareAtPriceCents)}</del>}
            {formatCents(unitPriceCents, product.currency)}
          </span>
          <span className="shop-save-label">Order More, Save More</span>
        </div>

        <dl className="shop-variant-facts" aria-live="polite">
          <div><dt>SKU</dt><dd>{option?.sku || product.sku}</dd></div>
          <div><dt>Availability</dt><dd>{stockLabel(option)}</dd></div>
          <div><dt>Shipping</dt><dd>{restrictionLabels(option).join(' · ') || 'No listed restrictions'}</dd></div>
          <div><dt>Package</dt><dd>{dimensionsLabel(option)}</dd></div>
        </dl>

        <div className="shop-discount-summary" aria-live="polite">
          <span>
            {quantity} × {formatMoney(unitPrice)} · {discountPercent}% discount
          </span>
          <span>
            You save <strong>{formatMoney(savings)}</strong>
          </span>
          <span>
            Total <strong>{formatMoney(total)}</strong>
          </span>
        </div>

        <div className="shop-card-actions">
          <button
            className="shop-add-button"
            type="button"
            disabled={product.comingSoon || !optionAvailable}
            onClick={addToCart}
          >
            {product.comingSoon ? 'COMING SOON' : 'ADD TO CART'}
          </button>
          <a
            className="shop-learn-button"
            href={productPath(product)}
            onClick={(event) => {
              if (!onLearnMore || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              onLearnMore(product)
            }}
          >
            LEARN MORE
          </a>
        </div>
      </div>
    </article>
  )
}

export default function ShopPage({ searchQuery = '', onAddToCart, onLearnMore, onNavigate }) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('default')
  const [clearedSearchQuery, setClearedSearchQuery] = useState(null)
  const incomingSearchQuery = String(searchQuery ?? '').trim()
  const activeSearchQuery = clearedSearchQuery === incomingSearchQuery ? '' : incomingSearchQuery

  useEffect(() => {
    setClearedSearchQuery(null)
  }, [searchQuery])

  const productsByType = useMemo(() => {
    return Object.fromEntries(
      SECTION_ORDER.map((type) => {
        const products = shopProducts.filter(
          (product) =>
            productMatchesType(product, type) &&
            productMatchesResearchCategory(product, selectedCategory) &&
            productMatchesSearch(product, activeSearchQuery),
        )

        return [type, sortProducts(products, sortBy)]
      }),
    )
  }, [activeSearchQuery, selectedCategory, sortBy])

  const searchResultCount = useMemo(
    () => Object.values(productsByType).reduce((total, products) => total + products.length, 0),
    [productsByType],
  )

  function jumpToType(type) {
    scrollToId(type === 'ALL' ? 'shop-catalog' : sectionDomId(type))
  }

  function followResource(event, route) {
    if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(route)
  }

  return (
    <section className="shop-page" aria-labelledby="shop-page-title">
      <h1 className="shop-title" id="shop-page-title">
        Research Peptides for Laboratory Use
      </h1>
      <p className="shop-intro">
        Browse research vials, capsules, liquids, and topicals with third-party U.S. testing,
        searchable batch Certificates of Analysis, and clear in-vitro research-use labeling.
      </p>

      <div className="shop-controls">
        <div className="shop-control-group shop-control-group--types">
          <span className="shop-control-label">Jump to Product Type:</span>
          <div className="shop-type-filter" aria-label="Jump to product type">
            {JUMP_ORDER.map((type) => (
              <button
                className={`shop-chip${type === 'ALL' ? ' shop-chip--active' : ` shop-chip--${domId(type)}`}`}
                type="button"
                onClick={() => jumpToType(type)}
                key={type}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="shop-control-group shop-control-group--research">
          <span className="shop-control-label">Filter by Research Categories:</span>
          <div className="shop-research-filter" aria-label="Filter by research category">
            {researchChoices.map((category) => {
              const active = selectedCategory === category.value
              return (
                <button
                  className={`shop-chip${active ? ' shop-chip--active' : ''}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedCategory(category.value)}
                  key={category.value}
                >
                  {category.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="shop-control-group shop-control-group--sort">
          <label className="shop-control-label" htmlFor="shop-product-sort">
            Product Filters:
          </label>
          <select
            className="shop-sort"
            id="shop-product-sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeSearchQuery && (
        <div className="shop-search-notice" role="status" aria-live="polite">
          <span className="shop-search-message">
            {searchResultCount} {searchResultCount === 1 ? 'result' : 'results'} for “{activeSearchQuery}”
          </span>
          <button
            className="shop-search-clear"
            type="button"
            onClick={() => setClearedSearchQuery(incomingSearchQuery)}
          >
            Clear search
          </button>
        </div>
      )}

      <div className="shop-catalog-layout" id="shop-catalog">
        <aside className="shop-sidebar" aria-label="Product list">
          <h2 className="shop-sidebar-title">Product List</h2>
          {SIDEBAR_ORDER.map((type) => {
            const products = productsByType[type]
            return (
              <section className="shop-sidebar-group" key={type}>
                <h3 className="shop-sidebar-group-title">{type}</h3>
                {products.length > 0 ? (
                  <ul className="shop-sidebar-list">
                    {products.map((product) => (
                      <li key={product.id}>
                        <a className="shop-sidebar-link" href={`#${productDomId(product)}`}>
                          {product.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="shop-empty">No matching products.</p>
                )}
              </section>
            )
          })}
        </aside>

        <div className="shop-content">
          {SECTION_ORDER.map((type) => {
            const products = productsByType[type]
            const headingId = `${sectionDomId(type)}-heading`

            return (
              <section
                className="shop-section"
                id={sectionDomId(type)}
                aria-labelledby={headingId}
                key={type}
              >
                <h2 className="shop-section-heading" id={headingId}>
                  {type} - {products.length} {products.length === 1 ? 'result' : 'results'}
                </h2>

                {products.length > 0 ? (
                  <div className="shop-grid">
                    {products.map((product) => (
                      <ProductCard
                        product={product}
                        onAddToCart={onAddToCart}
                        onLearnMore={onLearnMore}
                        key={product.id}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="shop-empty">
                    No {type.toLocaleLowerCase()} match this research category.
                  </p>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <section className="shop-seo-band" aria-label="About our research peptides">
        <h2>COA-verified research peptides for controlled laboratory use</h2>
        <p>
          Pure Health Peptides supplies research materials to qualified professionals and
          institutions for controlled in-vitro work. Each available batch is independently tested
          for identity, purity, and quantity, with documentation searchable by batch ID.
        </p>
        <p>
          Use the resources below to review batch testing, quality controls, and laboratory handling
          guidance. Products are for research use only and are not intended for human or veterinary use.
        </p>
        <nav className="shop-resource-links" aria-label="Research peptide resources">
          <a href="/coa-library/" onClick={(event) => followResource(event, 'coaLibrary')}>Search batch COAs</a>
          <a href="/coa-process/" onClick={(event) => followResource(event, 'testing')}>How peptide testing works</a>
          <a href="/manufacturing/" onClick={(event) => followResource(event, 'manufacturing')}>Quality and manufacturing</a>
          <a href="/dilution-guide/" onClick={(event) => followResource(event, 'dilution')}>Laboratory dilution guide</a>
        </nav>
      </section>
    </section>
  )
}
