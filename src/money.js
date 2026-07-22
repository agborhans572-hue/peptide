const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
})

export function formatCents(cents, currency = 'USD') {
  if (currency !== 'USD') throw new RangeError(`Unsupported storefront currency: ${currency}`)
  return Number.isInteger(cents) ? usdFormatter.format(cents / 100) : 'Unavailable'
}

export function stockLabel(variant) {
  if (!variant?.available || variant.stockQuantity === 0) return 'Out of stock'
  if (Number.isInteger(variant.stockQuantity) && variant.stockQuantity <= 10) return `Only ${variant.stockQuantity} left`
  return 'In stock'
}

const restrictionCopy = {
  US_DOMESTIC_ONLY: 'Ships to U.S. addresses only', NO_PO_BOX: 'No P.O. boxes', GROUND_ONLY: 'Ground shipping required',
}

export function restrictionLabels(variant) {
  return (variant?.shippingRestrictions || []).map((code) => restrictionCopy[code] || code)
}

export function dimensionsLabel(variant) {
  const dimensions = variant?.packageDimensionsMm
  if (!variant?.shippingWeightGrams || !dimensions?.length || !dimensions?.width || !dimensions?.height) return 'Package measurements pending approval'
  return `${variant.shippingWeightGrams} g · ${dimensions.length} × ${dimensions.width} × ${dimensions.height} mm`
}
