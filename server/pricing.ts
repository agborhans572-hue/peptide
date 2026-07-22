import catalogData from './catalog.generated.json'

export const SHIPPING_CENTS = 1099
export const FREE_SHIPPING_THRESHOLD_CENTS = 17500
export const MAX_CART_LINES = 25
export const MAX_LINE_QUANTITY = 100

export type CatalogVariant = {
  id: string
  wooVariantId: number
  sku: string
  label: string
  priceCents: number
  compareAtPriceCents: number | null
  available: boolean
  stockQuantity: number | null
  maxQty: number | null
  image: string
  imageAlt: string
  shippingWeightGrams: number | null
  packageDimensionsMm: { length: number | null, width: number | null, height: number | null }
  shippingRestrictions: string[]
}

export type CatalogProduct = {
  id: string
  wooProductId: number
  name: string
  slug: string
  sku: string
  image: string
  currency: 'USD'
  discountRule: number
  status: string
  visibility: string
  options: CatalogVariant[]
}

type ServerCatalog = { version: string, products: CatalogProduct[] }
const snapshot = catalogData as ServerCatalog
export const catalogVersion = snapshot.version
const catalog = new Map(snapshot.products.map((product) => [product.id, product]))

export type RequestedCartItem = {
  productId: string
  variantId: string
  quantity: number
}

export type PricedCartItem = {
  productId: string
  variantId: string
  productName: string
  option: string
  sku: string
  image: string
  quantity: number
  unitAmountCents: number
  discountBasisPoints: number
  subtotalCents: number
  totalCents: number
  productSnapshot: {
    catalogVersion: string
    productId: string
    variantId: string
    wooProductId: number
    wooVariantId: number
    sku: string
    name: string
    option: string
    unitAmountCents: number
    currency: 'usd'
    shippingWeightGrams: number | null
    packageDimensionsMm: CatalogVariant['packageDimensionsMm']
    shippingRestrictions: string[]
  }
}

function discountBasisPoints(discountRule: number, quantity: number) {
  if (quantity < 2) return 0
  if (discountRule === 2) return quantity === 2 ? 500 : 750
  return Math.min(quantity, 15) * 100
}

export function lookupCatalogVariant(productId: string, variantId: string) {
  const product = catalog.get(productId)
  const variant = product?.options.find((candidate) => candidate.id === variantId)
  return product && variant ? { product, variant } : null
}

export function priceCart(requestedItems: RequestedCartItem[]) {
  if (requestedItems.length === 0 || requestedItems.length > MAX_CART_LINES) {
    throw new Error('The cart must contain between 1 and 25 line items.')
  }

  const items = requestedItems.map<PricedCartItem>((requested) => {
    const match = lookupCatalogVariant(requested.productId, requested.variantId)
    if (!match) throw new Error(`Unknown product or variant: ${requested.productId}/${requested.variantId}`)
    const { product, variant } = match
    if (product.status !== 'published' || product.visibility !== 'visible' || !variant.available) {
      throw new Error(`Unavailable variant for ${product.name}.`)
    }
    if (!Number.isInteger(requested.quantity) || requested.quantity < 1) {
      throw new Error('Every quantity must be a positive whole number.')
    }

    const maximum = Math.min(variant.maxQty ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY)
    if (requested.quantity > maximum) throw new Error(`Quantity exceeds availability for ${product.name}.`)

    const unitAmountCents = variant.priceCents
    const subtotalCents = unitAmountCents * requested.quantity
    const basisPoints = discountBasisPoints(product.discountRule, requested.quantity)
    const totalCents = product.discountRule === 2 && basisPoints > 0
      ? Math.round(unitAmountCents * (1 - basisPoints / 10_000)) * requested.quantity
      : Math.round(subtotalCents * (1 - basisPoints / 10_000))
    const snapshot = {
      catalogVersion,
      productId: product.id,
      variantId: variant.id,
      wooProductId: product.wooProductId,
      wooVariantId: variant.wooVariantId,
      sku: variant.sku,
      name: product.name,
      option: variant.label,
      unitAmountCents,
      currency: 'usd' as const,
      shippingWeightGrams: variant.shippingWeightGrams,
      packageDimensionsMm: variant.packageDimensionsMm,
      shippingRestrictions: variant.shippingRestrictions,
    }

    return {
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      option: variant.label,
      sku: variant.sku,
      image: variant.image || product.image,
      quantity: requested.quantity,
      unitAmountCents,
      discountBasisPoints: basisPoints,
      subtotalCents,
      totalCents,
      productSnapshot: snapshot,
    }
  })

  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0)
  const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS

  return {
    catalogVersion,
    items,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    currency: 'usd' as const,
  }
}
