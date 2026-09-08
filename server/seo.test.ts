import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Build-time JavaScript module.
import { productDocumentFilename } from '../scripts/catalog-document.mjs'
import access from '../catalog/product-route-access.generated.json'
// @ts-expect-error Edge runtime JavaScript module.
import { createProductRouteGuard } from '../netlify/edge-functions/product-route-guard.js'

test('metadata-only and detail-only edits change the immutable document URL without changing the checkout version', () => {
  const original = { version: 'checkout-contract', slug: 'bpc-157', detail: { title: 'BPC-157' }, metadata: { description: 'Original description' } }
  const metadataEdit = { ...original, metadata: { description: 'Updated description' } }
  const detailEdit = { ...original, detail: { title: 'Updated details' } }
  assert.notEqual(productDocumentFilename(original), productDocumentFilename(metadataEdit))
  assert.notEqual(productDocumentFilename(original), productDocumentFilename(detailEdit))
  assert.equal(metadataEdit.version, original.version)
  assert.equal(productDocumentFilename(original), productDocumentFilename(JSON.parse(JSON.stringify(original))))
})

test('portable product guard preserves all raw legacy identities, queries, and single-hop canonical termination', async () => {
  const guard = createProductRouteGuard(access)
  const context = { next: async () => new Response('canonical', { status: 200 }) }
  assert.equal(Object.keys(access.redirects).length, 32)
  for (const [slug, canonical] of Object.entries(access.redirects)) {
    for (const suffix of ['/', '', '/index.html']) {
      const request = new Request(`https://example.test/product/${encodeURIComponent(slug)}${suffix}?variant=420&utm_source=a%2Bb`)
      const response = await guard(request, context)
      assert.equal(response.status, 301, slug)
      assert.equal(response.headers.get('location'), `https://example.test/product/${canonical}/?variant=420&utm_source=a%2Bb`)
      assert.equal((await guard(new Request(response.headers.get('location')!), context)).status, 200, slug)
    }
  }
})
