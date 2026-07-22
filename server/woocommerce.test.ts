import assert from 'node:assert/strict'
import test from 'node:test'
import { revalidateWooCart } from '../netlify/functions/_shared/woocommerce.ts'
import { HttpError } from '../netlify/functions/_shared/http.ts'

const env = { WOOCOMMERCE_URL: 'https://woo.example', WC_CONSUMER_KEY: 'ck_test_value', WC_CONSUMER_SECRET: 'cs_test_value' }
const item = { productId: 'vials-419', variantId: '420', quantity: 1 }

function responseFor(url: URL, { price = '22.00', stock = 1165 } = {}) {
  if (url.pathname.includes('/variations/')) {
    return new Response(JSON.stringify({ id: 420, status: 'publish', purchasable: true, price, stock_status: 'instock', stock_quantity: stock }), { status: 200 })
  }
  return new Response(JSON.stringify({ id: 419, status: 'publish', catalog_visibility: 'visible', purchasable: true }), { status: 200 })
}

test('accepts an unchanged live WooCommerce variant', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => responseFor(new URL(String(input)))
  try { await revalidateWooCart(env, [item]) } finally { globalThis.fetch = originalFetch }
})

test('returns conflict when live price or stock changed', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => responseFor(new URL(String(input)), { price: '23.00' })
  try {
    await assert.rejects(revalidateWooCart(env, [item]), (error: unknown) => error instanceof HttpError && error.statusCode === 409)
  } finally { globalThis.fetch = originalFetch }
})

test('fails closed when WooCommerce cannot be reached', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('network unavailable') }
  try {
    await assert.rejects(revalidateWooCart(env, [item]), (error: unknown) => error instanceof HttpError && error.statusCode === 503)
  } finally { globalThis.fetch = originalFetch }
})
