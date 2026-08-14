import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import test from 'node:test'
import { reserveWooOrder } from '../netlify/functions/_shared/woo-bridge.ts'
import { HttpError } from '../netlify/functions/_shared/http.ts'

const env = {
  WOOCOMMERCE_URL: 'https://woo.example',
  WOO_BRIDGE_SECRET_CURRENT: 'test-current-secret-with-enough-entropy',
}
const input = {
  catalogVersion: 'catalog-v1',
  checkoutAttemptId: 'd5ff62f9-e11d-4a70-a41e-08ca02296ef0',
  currency: 'usd',
  items: [{
    productSnapshot: { wooProductId: 419, wooVariantId: 420 },
    quantity: 1,
    unitAmountCents: 2200,
    subtotalCents: 2200,
    totalCents: 2200,
  }],
  shippingCents: 1099,
  subtotalCents: 2200,
  totalCents: 3299,
}

test('reservation bridge signs one canonical request without sending browser totals as authority', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (request, init) => {
    calls += 1
    const url = new URL(String(request))
    const body = String(init?.body || '')
    const headers = new Headers(init?.headers)
    const timestamp = headers.get('X-PHP-Timestamp') || ''
    const nonce = headers.get('X-PHP-Nonce') || ''
    const canonical = [timestamp, nonce, 'POST', url.pathname.replace('/wp-json', ''), createHash('sha256').update(body).digest('hex')].join('\n')
    const expected = createHmac('sha256', env.WOO_BRIDGE_SECRET_CURRENT).update(canonical).digest('base64')
    assert.equal(headers.get('X-PHP-Signature'), expected)
    const payload = JSON.parse(body)
    assert.deepEqual(payload.items, [{
      expectedUnitCents: 2200,
      quantity: 1,
      subtotalCents: 2200,
      totalCents: 2200,
      wooProductId: 419,
      wooVariationId: 420,
    }])
    return Response.json({ wooOrderId: 91, status: 'checkout-draft', totalCents: 3299, replayed: false })
  }
  try {
    const order = await reserveWooOrder(env, input as never)
    assert.equal(order.wooOrderId, 91)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('reservation conflicts are surfaced without retrying', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return Response.json({ code: 'insufficient_stock', message: 'Only 1 remains.' }, { status: 409 })
  }
  try {
    await assert.rejects(
      reserveWooOrder(env, input as never),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && error.retryable === false,
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('transient Woo failures retry once and then fail closed', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return Response.json({ code: 'unavailable', message: 'maintenance' }, { status: 503 })
  }
  try {
    await assert.rejects(
      reserveWooOrder(env, input as never),
      (error: unknown) => error instanceof HttpError && error.statusCode === 503 && error.retryable === true,
    )
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})
