import { shopProducts } from './catalog.js'
import { appPath, canonicalPath } from './appPath.js'

const PRODUCT_PATH_PATTERN = /^\/product\/([^/?#]+)\/?$/i

function pathnameFrom(value) {
  const input = String(value ?? '').trim()
  if (!input) return ''

  try {
    return new URL(input, 'https://purehealthpeptidesshop.com').pathname
  } catch {
    return input.split(/[?#]/, 1)[0]
  }
}

function normalizedSlugKey(value) {
  const slug = String(value ?? '').trim()
  if (!slug) return ''

  try {
    return decodeURIComponent(slug).normalize('NFC').toLocaleLowerCase('en-US')
  } catch {
    return slug.toLocaleLowerCase('en-US')
  }
}

export function productSlugFromUrl(productUrl) {
  const pathname = pathnameFrom(productUrl)
  const segments = pathname.split('/').filter(Boolean)
  const productSegment = segments.findIndex((segment) => segment.toLocaleLowerCase() === 'product')

  if (productSegment < 0 || productSegment !== segments.length - 2) return ''
  return segments.at(-1) || ''
}

export function productSlug(product) {
  return productSlugFromUrl(product?.productUrl)
}

export const productBySlug = new Map()
const productByNormalizedSlug = new Map()

for (const product of shopProducts) {
  const slug = productSlug(product)
  if (!slug) {
    throw new Error(`Product “${product.name || product.id}” is missing a canonical product URL slug.`)
  }

  const normalizedSlug = normalizedSlugKey(slug)
  if (productByNormalizedSlug.has(normalizedSlug)) {
    const existing = productByNormalizedSlug.get(normalizedSlug)
    throw new Error(
      `Duplicate product slug “${slug}” for “${existing.name}” and “${product.name}”.`,
    )
  }

  productBySlug.set(slug, product)
  productByNormalizedSlug.set(normalizedSlug, product)
}

export function productPath(product) {
  const slug = productSlug(product)
  if (!slug) throw new TypeError('A product with a canonical productUrl is required.')
  return appPath(`/product/${slug}/`)
}

export function isProductPath(pathname) {
  return PRODUCT_PATH_PATTERN.test(canonicalPath(pathnameFrom(pathname)))
}

export function productFromPath(pathname) {
  const match = canonicalPath(pathnameFrom(pathname)).match(PRODUCT_PATH_PATTERN)
  if (!match) return null
  return productByNormalizedSlug.get(normalizedSlugKey(match[1])) || null
}
