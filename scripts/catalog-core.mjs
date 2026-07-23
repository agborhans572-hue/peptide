import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const SITE_ORIGIN = 'https://purehealthpepetidesshop.com'
export const SHIPPING_RESTRICTIONS = Object.freeze({
  US_DOMESTIC_ONLY: 'Ships only to addresses in the United States.',
  NO_PO_BOX: 'Cannot be shipped to a P.O. box.',
  GROUND_ONLY: 'Must ship using an eligible ground service.',
})

const typeSuffix = { vials: 'vial', capsules: 'capsules', liquids: 'liquid', topicals: 'topical' }
const placeholderPattern = /\b(lorem ipsum|placeholder|sample text|insert (copy|text)|todo|tbd)\b/i

export function stripHtml(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanSlug(value) {
  return String(value || '')
    .replaceAll('β', ' beta ')
    .replaceAll('Β', ' beta ')
    .replaceAll('⁺', ' plus ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseCsvRow(line) {
  const cells = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"'
      index += 1
    } else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) {
      cells.push(value)
      value = ''
    } else value += char
  }
  cells.push(value)
  return cells
}

export function readLogisticsCsv(path) {
  const source = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').trim()
  if (!source) return []
  const lines = source.split(/\r?\n/).filter(Boolean)
  const headers = parseCsvRow(lines.shift()).map((item) => item.trim())
  return lines.map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvRow(line)[index]?.trim() || ''])))
}

export function productSlugs(products, overrides = {}) {
  const byName = new Map()
  for (const product of products) {
    const key = cleanSlug(product.title)
    byName.set(key, [...(byName.get(key) || []), product])
  }

  const output = new Map()
  for (const [base, group] of byName) {
    const ordered = [...group].sort((left, right) => {
      const rank = { vials: 0, capsules: 1, liquids: 2, topicals: 3 }
      return (rank[left.type] ?? 9) - (rank[right.type] ?? 9) || left.id - right.id
    })
    ordered.forEach((product, index) => {
      const publicId = product.local?.id
      const override = overrides[publicId]
      const slug = override || (index === 0 ? base : `${base}-${typeSuffix[product.type] || product.type}`)
      output.set(product.id, cleanSlug(slug))
    })
  }
  return output
}

export function catalogHash(products) {
  return createHash('sha256').update(JSON.stringify(products)).digest('hex').slice(0, 20)
}

export function validateCatalog(catalog, { requireApprovedLogistics = false } = {}) {
  const errors = []
  const seen = { ids: new Set(), wooProductIds: new Set(), skus: new Set(), slugs: new Set(), variantIds: new Set(), wooVariantIds: new Set() }
  const categories = new Set(catalog.categories.map((category) => category.slug))

  for (const product of catalog.products) {
    if (seen.ids.has(product.id)) errors.push(`Duplicate product ID: ${product.id}`)
    seen.ids.add(product.id)
    if (!Number.isInteger(product.wooProductId) || seen.wooProductIds.has(product.wooProductId)) errors.push(`Missing or duplicate Woo product ID: ${product.id}`)
    seen.wooProductIds.add(product.wooProductId)
    if (!product.sku || seen.skus.has(product.sku.toLowerCase())) errors.push(`Missing or duplicate product SKU: ${product.id}`)
    seen.skus.add(product.sku.toLowerCase())
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) errors.push(`Unclean product slug: ${product.slug}`)
    if (seen.slugs.has(product.slug)) errors.push(`Duplicate product slug: ${product.slug}`)
    seen.slugs.add(product.slug)
    if (!product.name.trim() || placeholderPattern.test(product.name)) errors.push(`Invalid product name: ${product.id}`)
    if (stripHtml(product.shortDescriptionHtml).length < 40 || placeholderPattern.test(stripHtml(product.shortDescriptionHtml))) errors.push(`Invalid short description: ${product.id}`)
    if (stripHtml(product.descriptionHtml).length < 120 || placeholderPattern.test(stripHtml(product.descriptionHtml))) errors.push(`Invalid description: ${product.id}`)
    if (product.currency !== 'USD') errors.push(`Unsupported currency for ${product.id}: ${product.currency}`)
    if (!product.categories.length || product.categories.some((category) => !categories.has(category))) errors.push(`Invalid categories: ${product.id}`)
    if (!product.images.length || product.images.some((image) => !image.role || !image.src || !image.alt?.trim() || /\.(?:jpe?g|png|webp)$/i.test(image.alt.trim()) || /^(?:image|photo|product)$/i.test(image.alt.trim()))) errors.push(`Missing, generic, or filename-only product image alt text: ${product.id}`)
    if (product.images.some((image) => image.src.startsWith('/') && !existsSync(resolve('public', image.src.replace(/^\//, ''))))) errors.push(`Product image file is missing: ${product.id}`)
    if (!product.options.length) errors.push(`Product has no variants: ${product.id}`)
    if (requireApprovedLogistics && !product.logisticsApproved) errors.push(`Product logistics are not approved: ${product.id}`)
    if (requireApprovedLogistics && product.skuSource !== 'merchant') errors.push(`Product SKU is not merchant-approved: ${product.id}`)
    const expectedPrice = Math.min(...product.options.filter((variant) => variant.available).map((variant) => variant.priceCents), ...(!product.options.some((variant) => variant.available) ? product.options.map((variant) => variant.priceCents) : []))
    if (product.priceCents !== expectedPrice) errors.push(`Product minimum price is inconsistent: ${product.id}`)

    for (const variant of product.options) {
      if (!variant.id || seen.variantIds.has(variant.id)) errors.push(`Missing or duplicate variant ID: ${product.id}/${variant.id}`)
      seen.variantIds.add(variant.id)
      if (!Number.isInteger(variant.wooVariantId) || seen.wooVariantIds.has(variant.wooVariantId)) errors.push(`Missing or duplicate Woo variant ID: ${product.id}/${variant.id}`)
      seen.wooVariantIds.add(variant.wooVariantId)
      if (!variant.sku || seen.skus.has(variant.sku.toLowerCase())) errors.push(`Missing or duplicate variant SKU: ${product.id}/${variant.id}`)
      seen.skus.add(variant.sku.toLowerCase())
      if (!Number.isInteger(variant.priceCents) || variant.priceCents < 0) errors.push(`Invalid variant price: ${product.id}/${variant.id}`)
      if (variant.compareAtPriceCents != null && variant.compareAtPriceCents <= variant.priceCents) errors.push(`Invalid compare-at price: ${product.id}/${variant.id}`)
      if (!variant.image || !variant.imageAlt?.trim()) errors.push(`Missing variant image or alt: ${product.id}/${variant.id}`)
      if (variant.image.startsWith('/') && !existsSync(resolve('public', variant.image.replace(/^\//, '')))) errors.push(`Variant image file is missing: ${product.id}/${variant.id}`)
      if (variant.stockQuantity != null && (!Number.isInteger(variant.stockQuantity) || variant.stockQuantity < 0)) errors.push(`Invalid stock quantity: ${product.id}/${variant.id}`)
      if (variant.stockQuantity === 0 && variant.available) errors.push(`Out-of-stock variant is purchasable: ${product.id}/${variant.id}`)
      if (requireApprovedLogistics && !variant.logisticsApproved) errors.push(`Variant logistics are not approved: ${product.id}/${variant.id}`)
      if (requireApprovedLogistics && variant.skuSource !== 'merchant') errors.push(`Variant SKU is not merchant-approved: ${product.id}/${variant.id}`)
      if (requireApprovedLogistics && (!variant.shippingWeightGrams || Object.values(variant.packageDimensionsMm).some((value) => !value))) errors.push(`Variant logistics are incomplete: ${product.id}/${variant.id}`)
      for (const restriction of variant.shippingRestrictions) {
        if (!SHIPPING_RESTRICTIONS[restriction]) errors.push(`Unknown shipping restriction ${restriction}: ${product.id}/${variant.id}`)
      }
    }
  }
  return errors
}
