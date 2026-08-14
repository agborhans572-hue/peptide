import { createHash, createHmac, randomUUID } from 'node:crypto'
import type { PricedCartItem } from '../../../server/pricing.ts'
import { HttpError } from './http.ts'

type BridgeEnvironment = {
  WOOCOMMERCE_URL: string
  WOO_BRIDGE_SECRET_CURRENT?: string
}

type BridgeOrder = {
  expiresAt?: string
  paid?: boolean
  replayed: boolean
  status: string
  totalCents: number
  wooOrderId: number
}

type ReservationInput = {
  catalogVersion: string
  checkoutAttemptId: string
  currency: string
  items: PricedCartItem[]
  shippingCents: number
  subtotalCents: number
  totalCents: number
}

type PaymentInput = {
  amountTotal: number
  customer: {
    billing: Record<string, string>
    shipping: Record<string, string>
  }
  eventId: string
  paymentIntentId: string | null
  sessionId: string
}

function bridgeSignature(secret: string, method: string, route: string, body: string, timestamp: string, nonce: string) {
  const bodyHash = createHash('sha256').update(body).digest('hex')
  const canonical = [timestamp, nonce, method.toUpperCase(), route, bodyHash].join('\n')
  return createHmac('sha256', secret).update(canonical).digest('base64')
}

async function bridgeRequest<T>(
  env: BridgeEnvironment,
  method: 'GET' | 'POST',
  route: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  if (!env.WOO_BRIDGE_SECRET_CURRENT) {
    throw new HttpError(503, 'Checkout reservations are not configured.', 'reservation_unavailable', undefined, true)
  }
  const body = payload ? JSON.stringify(payload) : ''
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = randomUUID()
    const url = new URL(`/wp-json${route}`, env.WOOCOMMERCE_URL)
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          'X-PHP-Nonce': nonce,
          'X-PHP-Signature': bridgeSignature(env.WOO_BRIDGE_SECRET_CURRENT, method, route, body, timestamp, nonce),
          'X-PHP-Timestamp': timestamp,
        },
        body: body || undefined,
        signal: AbortSignal.timeout(8_000),
      })
      const data = await response.json().catch(() => ({})) as Record<string, unknown>
      if (response.ok) return data as T
      const code = typeof data.code === 'string' ? data.code : 'woo_bridge_failed'
      const message = typeof data.message === 'string' ? data.message : 'Inventory reservation is temporarily unavailable.'
      if (response.status === 409 || response.status === 400) {
        throw new HttpError(response.status, message, code, data.data, false)
      }
      if (response.status !== 429 && response.status < 500) {
        throw new HttpError(503, 'Inventory reservation is temporarily unavailable.', code, undefined, true)
      }
      lastError = new Error(`${code}: ${message}`)
    } catch (error) {
      if (error instanceof HttpError) throw error
      lastError = error
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 75 + Math.floor(Math.random() * 75)))
  }
  throw new HttpError(503, 'Inventory reservation is temporarily unavailable. Please try again.', 'woo_bridge_unavailable', lastError, true)
}

export function reserveWooOrder(env: BridgeEnvironment, input: ReservationInput) {
  return bridgeRequest<BridgeOrder>(env, 'POST', '/php-commerce/v1/reservations', {
    catalogVersion: input.catalogVersion,
    checkoutAttemptId: input.checkoutAttemptId,
    currency: input.currency,
    items: input.items.map((item) => ({
      expectedUnitCents: item.unitAmountCents,
      quantity: item.quantity,
      subtotalCents: item.subtotalCents,
      totalCents: item.totalCents,
      wooProductId: item.productSnapshot.wooProductId,
      wooVariationId: item.productSnapshot.wooVariantId,
    })),
    shippingCents: input.shippingCents,
    subtotalCents: input.subtotalCents,
    totalCents: input.totalCents,
  })
}

export function completeWooPayment(env: BridgeEnvironment, wooOrderId: number, input: PaymentInput) {
  return bridgeRequest<BridgeOrder>(env, 'POST', `/php-commerce/v1/orders/${wooOrderId}/payment`, input)
}

export function cancelWooOrder(
  env: BridgeEnvironment,
  wooOrderId: number,
  input: { eventId?: string, reason: string },
) {
  return bridgeRequest<BridgeOrder>(env, 'POST', `/php-commerce/v1/orders/${wooOrderId}/cancel`, input)
}

export function refundWooOrder(
  env: BridgeEnvironment,
  wooOrderId: number,
  input: { amountRefunded: number, eventId: string },
) {
  return bridgeRequest<BridgeOrder>(env, 'POST', `/php-commerce/v1/orders/${wooOrderId}/refund`, input)
}

export function getWooOrder(env: BridgeEnvironment, wooOrderId: number) {
  return bridgeRequest<BridgeOrder>(env, 'GET', `/php-commerce/v1/orders/${wooOrderId}`)
}
