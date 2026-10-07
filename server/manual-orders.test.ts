import assert from 'node:assert/strict'
import test from 'node:test'
import { orderEmail, prepareOrder, STORE_MAILBOX } from './manual-orders.js'

const request = {
  submissionId: '12345678-1234-4234-8234-123456789012', captchaToken: 'test', researchAgreement: true,
  customer: { firstName: 'Jane', lastName: 'Smith', email: 'customer@example.com', phone: '+1 555 123 4567',
    company: 'Lab', address: '123 Main Street', address2: 'Suite 2', city: 'Boston', state: 'MA', postalCode: '02101', country: 'United States' },
  items: [{ productId: 'vials-419', variantId: '420', quantity: 1 }], totalCents: 1,
}
test('manual orders use authoritative pricing and include complete delivery/contact details in both receipts', () => {
  const order = prepareOrder(request)
  assert.equal(order.cart.totalCents, 3299)
  assert.equal(STORE_MAILBOX, 'info@purehealthpeptidesshop.com')
  for (const audience of ['store','customer'] as const) {
    const email = orderEmail(order, 'PHP-00000001', '2026-10-07', audience)
    for (const value of ['Suite 2','123 Main Street','02101','customer@example.com','+1 555 123 4567','$32.99 USD','awaiting payment']) assert.ok(email.text.includes(value))
    assert.ok(email.text.includes('Our team will contact you by email or phone to finalize payment.'))
  }
})
test('invalid delivery, agreement, quantities and duplicate lines are rejected', () => {
  assert.throws(() => prepareOrder({ ...request, researchAgreement: false }))
  assert.throws(() => prepareOrder({ ...request, customer: { ...request.customer, email: 'bad' } }))
  assert.throws(() => prepareOrder({ ...request, items: [request.items[0], request.items[0]] }))
  assert.throws(() => prepareOrder({ ...request, items: [{ ...request.items[0], quantity: 0 }] }))
})
test('email HTML escapes customer-provided markup', () => {
  const order = prepareOrder({ ...request, customer: { ...request.customer, firstName: '<script>evil</script>' } })
  assert.ok(!orderEmail(order, 'PHP-1', 'today', 'store').html.includes('<script>'))
})
