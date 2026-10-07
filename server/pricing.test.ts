import assert from 'node:assert/strict'
import test from 'node:test'
import { priceCart, SHIPPING_CENTS, shippingForSubtotal } from './pricing.ts'

test('prices a catalog item on the server and adds shipping', () => {
  const cart = priceCart([{ productId: 'vials-419', variantId: '420', quantity: 1 }])
  assert.equal(cart.subtotalCents, 2200)
  assert.equal(cart.shippingCents, SHIPPING_CENTS)
  assert.equal(cart.totalCents, 3299)
})

test('applies quantity pricing and free shipping from canonical data', () => {
  const cart = priceCart([{ productId: 'vials-419', variantId: '2501', quantity: 5 }])
  assert.equal(cart.subtotalCents, 19000)
  assert.equal(cart.shippingCents, 0)
})

test('rejects client-controlled products and quantities', () => {
  assert.throws(() => priceCart([{ productId: 'not-real', variantId: '420', quantity: 1 }]))
  assert.throws(() => priceCart([{ productId: 'vials-419', variantId: '420', quantity: 0 }]))
})

test('shipping is charged below $175 and free at and above the discounted threshold', () => {
  assert.equal(shippingForSubtotal(17499), 1099)
  assert.equal(shippingForSubtotal(17500), 0)
  assert.equal(shippingForSubtotal(17501), 0)
  const cart = priceCart([{ productId: 'vials-419', variantId: '420', quantity: 8 }])
  assert.equal(cart.items[0].subtotalCents, 17600)
  assert.ok(cart.subtotalCents < 17500)
  assert.equal(cart.shippingCents, 1099)
})
