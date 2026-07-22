import assert from 'node:assert/strict'
import test from 'node:test'
import catalog from '../catalog/catalog.generated.json'
// @ts-expect-error The build-time catalog validator is a JavaScript ESM module.
import { validateCatalog } from '../scripts/catalog-core.mjs'
// @ts-expect-error Netlify Edge Functions execute as JavaScript in the edge runtime.
import { createProductRouteGuard } from '../netlify/edge-functions/product-route-guard.js'
// @ts-expect-error The homepage catalog is a JSX module executed by the test runner.
import { homeCategories } from '../src/Catalog.jsx'

test('validates every normalized product and variant', () => {
  assert.deepEqual(validateCatalog(catalog), [])
  assert.equal(catalog.products.length, 115)
  assert.equal(catalog.products.reduce((sum, product) => sum + product.options.length, 0), 181)
  assert.ok(catalog.products.every((product) => product.currency === 'USD'))
  assert.ok(catalog.products.every((product) => product.options.every((variant) => variant.sku && variant.imageAlt)))
})

test('homepage featured products reference stable public catalog IDs', () => {
  const catalogIds = new Set(catalog.products.map((product) => product.id))
  const featured = homeCategories.flatMap((category: any) => category.products.map((product: any) => ({ ...product, type: category.key })))
  assert.equal(featured.length, 32)
  assert.equal(new Set(featured.map((product: any) => product.productId)).size, featured.length)
  for (const product of featured) {
    assert.ok(catalogIds.has(product.productId), `${product.name} references a missing product ID`)
    assert.equal(catalog.products.find((candidate) => candidate.id === product.productId)?.type, product.type)
  }
})

test('product edge guard passes published routes, redirects legacy routes, and rejects inaccessible routes', async () => {
  const guard = createProductRouteGuard({
    published: ['current-product'],
    redirects: { 'legacy-product-2': 'current-product' },
    retired: [{ wooProductId: 1, slug: 'retired-product', legacySlugs: ['old-retired-product'] }],
  })
  const context = { next: async () => new Response('ok', { status: 200 }) }
  assert.equal((await guard(new Request('https://example.test/product/current-product/'), context)).status, 200)
  const redirect = await guard(new Request('https://example.test/product/legacy-product-2/'), context)
  assert.equal(redirect.status, 301)
  assert.equal(redirect.headers.get('location'), 'https://example.test/product/current-product/')
  assert.equal((await guard(new Request('https://example.test/product/retired-product/'), context)).status, 410)
  assert.equal((await guard(new Request('https://example.test/product/hidden-product/'), context)).status, 404)
})
