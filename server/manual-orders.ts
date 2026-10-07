import { z } from 'zod'
import { priceCart } from './pricing.ts'

const field = z.string().trim().min(1).max(160)
export const orderRequestSchema = z.object({
  submissionId: z.string().uuid(),
  captchaToken: z.string().min(1).max(4096),
  researchAgreement: z.literal(true),
  customer: z.object({
    firstName: field, lastName: field, email: z.string().trim().email().max(254),
    phone: z.string().trim().regex(/^[+()\d .-]{7,30}$/),
    company: z.string().trim().max(160).default(''), address: field,
    address2: z.string().trim().max(160).default(''), city: field,
    state: z.string().regex(/^[A-Z]{2}$/), postalCode: z.string().regex(/^\d{5}(-\d{4})?$/),
    country: z.literal('United States'),
  }),
  items: z.array(z.object({ productId: field, variantId: field, quantity: z.number().int().min(1).max(100) })).min(1).max(25),
})
export function prepareOrder(input: unknown) {
  const request = orderRequestSchema.parse(input)
  const keys = request.items.map(item => `${item.productId}:${item.variantId}`)
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate cart lines.')
  return { customer: request.customer, cart: priceCart(request.items), researchAgreement: true }
}
export type ManualOrder = ReturnType<typeof prepareOrder>
export const STORE_MAILBOX = 'info@purehealthpeptidesshop.com'
export function orderEmail(order: ManualOrder, number: string, date: string, audience: 'store' | 'customer') {
  const c = order.customer
  const money = (cents: number) => `$${(cents / 100).toFixed(2)} USD`
  const text = [audience === 'store' ? 'New order request — awaiting payment' : 'Your order request — awaiting payment',
    `Order: ${number}`, `Submitted: ${date}`, `${c.firstName} ${c.lastName}`, `Email: ${c.email}`, `Phone: ${c.phone}`,
    'Delivery address:', c.company, c.address, c.address2, `${c.city}, ${c.state} ${c.postalCode}`, c.country,
    '', ...order.cart.items.map(i => `${i.quantity} × ${i.productName} (${i.option}) | SKU: ${i.sku} | ${money(i.totalCents)}`),
    `Subtotal: ${money(order.cart.subtotalCents)}`, `Shipping: ${money(order.cart.shippingCents)}`, `Estimated total: ${money(order.cart.totalCents)}`,
    'Research agreement accepted.', 'Our team will contact you by email or phone to finalize payment.',
    'Payment and shipment remain pending.'].filter(Boolean).join('\n')
  const escaped = text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
  return { subject: `Order request ${number} — awaiting payment`, text, html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${escaped}</div>` }
}
