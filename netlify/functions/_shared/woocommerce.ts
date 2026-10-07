import { lookupCatalogVariant, type RequestedCartItem } from '../../../server/pricing.js'
import { HttpError } from './http.js'

type WooProduct = {
  id: number
  status?: string
  catalog_visibility?: string
  purchasable?: boolean
}

type WooVariation = {
  id: number
  status?: string
  purchasable?: boolean
  price?: string
  stock_status?: string
  stock_quantity?: number | null
  manage_stock?: boolean | 'parent'
}

type WooCredentials = { WOOCOMMERCE_URL: string, WC_CONSUMER_KEY: string, WC_CONSUMER_SECRET: string }

async function wooGet<T>(env: WooCredentials, path: string): Promise<T> {
  const url = new URL(`/wp-json/wc/v3/${path.replace(/^\//, '')}`, env.WOOCOMMERCE_URL)
  const authorization = Buffer.from(`${env.WC_CONSUMER_KEY}:${env.WC_CONSUMER_SECRET}`).toString('base64')
  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: `Basic ${authorization}` },
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new HttpError(503, 'Checkout verification is temporarily unavailable. Please try again.', 'woo_unavailable')
  }
  if (!response.ok) {
    throw new HttpError(503, 'Checkout verification is temporarily unavailable. Please try again.', 'woo_unavailable')
  }
  return response.json() as Promise<T>
}

export async function revalidateWooCart(env: WooCredentials, items: RequestedCartItem[]) {
  const results = await Promise.all(items.map(async (item) => {
    const match = lookupCatalogVariant(item.productId, item.variantId)
    if (!match) throw new HttpError(409, 'The catalog changed. Refresh your cart before checkout.', 'catalog_changed')
    const { product, variant } = match
    if (product.status !== 'published' || product.visibility !== 'visible' || !variant.available || (variant.maxQty != null && item.quantity > variant.maxQty)) {
      throw new HttpError(409, 'One or more products are no longer available. Refresh your cart before checkout.', 'catalog_changed')
    }
    const [liveProduct, liveVariant] = await Promise.all([
      wooGet<WooProduct>(env, `products/${product.wooProductId}`),
      wooGet<WooVariation>(env, `products/${product.wooProductId}/variations/${variant.wooVariantId}`),
    ])
    const livePriceCents = Math.round(Number(liveVariant.price) * 100)
    const visible = liveProduct.status === 'publish'
      && !['hidden', 'search'].includes(liveProduct.catalog_visibility || '')
      && liveProduct.purchasable !== false
      && liveVariant.status === 'publish'
      && liveVariant.purchasable !== false
    const stockQuantity = liveVariant.stock_quantity
    const stockOkay = liveVariant.stock_status === 'instock'
      && (stockQuantity == null || stockQuantity >= item.quantity)
    if (!visible || !stockOkay || livePriceCents !== variant.priceCents) {
      return { productId: item.productId, variantId: item.variantId, reason: !visible ? 'visibility' : !stockOkay ? 'stock' : 'price' }
    }
    return null
  }))
  const changes = results.filter(Boolean)
  if (changes.length) {
    throw new HttpError(409, 'One or more products changed. Refresh your cart before checkout.', 'catalog_changed', changes)
  }
}
