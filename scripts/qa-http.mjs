import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { serveBuiltSite } from './serve-built-site.mjs'
import { routeManifest, productAliases } from './route-manifest.mjs'
import { getTransformedRoutes } from '@vercel/routing-utils'

const config = JSON.parse(await readFile('vercel.json', 'utf8'))
assert.deepEqual(JSON.parse(await readFile('dist/hosting-config.json', 'utf8')), config, 'built hosting rules are current')
const compiled = getTransformedRoutes(config)
assert.equal(compiled.error, null, JSON.stringify(compiled.error))
const { server, url } = await serveBuiltSite()
const results = []
async function request(path) {
  const response = await fetch(url + path, { redirect: 'manual' })
  const body = await response.text()
  results.push({ path, status: response.status, location: response.headers.get('location'), robots: response.headers.get('x-robots-tag'), cache: response.headers.get('cache-control') })
  return { response, body }
}
try {
  for (const route of routeManifest.routes.filter((r) => r.path)) {
    const { response, body } = await request(route.path + '?utm_source=seo%20test&variant=420&x=a%2Bb&x=2')
    assert.equal(response.status, route.expectedStatus, route.path)
    if (route.classification === 'permanent-redirect') {
      assert.equal(response.headers.get('location'), route.canonical + '?utm_source=seo%20test&variant=420&x=a%2Bb&x=2', route.path)
      assert.ok(routeManifest.routes.some((r) => r.path === route.canonical && ['indexable-200', 'private-noindex'].includes(r.classification)), 'redirect destination is a canonical page')
    } else if (route.classification === 'private-noindex') {
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', route.path)
      assert.equal(response.headers.get('cache-control'), 'private, no-store', route.path)
      assert.match(body, /name="robots"\s+content="noindex, nofollow"/, route.path)
    } else if (route.classification === 'indexable-200') {
      assert.match(response.headers.get('cache-control') || '', /must-revalidate/, route.path)
      assert.equal(response.headers.get('x-robots-tag'), null, route.path)
    } else {
      assert.match(body, /<h1>Page not found<\/h1>/i, route.path)
      assert.doesNotMatch(body, /rel="canonical"|"@type":"Product"/, route.path)
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow')
    }
  }
  for (const alias of productAliases) {
    for (const path of new Set([alias.path, alias.path.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase()), decodeURIComponent(alias.path), alias.path.slice(0, -1), alias.path + 'index.html'])) {
      const { response } = await request(path + '?variation_id=420&utm_source=legacy')
      assert.equal(response.status, 308, path)
      assert.equal(response.headers.get('location'), alias.canonical + '?variation_id=420&utm_source=legacy')
      const final = await request(response.headers.get('location'))
      assert.equal(final.response.status, 200, path + ' must terminate in one hop')
      assert.match(final.body, new RegExp('rel="canonical" href="https://purehealthpeptidesshop.com' + alias.canonical + '"'))
    }
  }
  for (const path of ['/unknown-route/', '/my-account/orders/', '/product/%2525/', '/product/%ZZ/', '/product-form/unknown/', '/nested/missing/index.html']) {
    const { response } = await request(path)
    assert.equal(response.status, 404, path)
    assert.match(response.headers.get('x-robots-tag'), /noindex/)
  }
  for (const path of ['/product-form/vials/', '/product-form/vials/page/2/']) {
    const { response } = await request(path + '?q=bpc')
    assert.equal(response.status, 308)
    assert.equal(response.headers.get('location'), '/shop/?q=bpc')
  }
  const docs = JSON.parse(await readFile('src/productDocumentManifest.json', 'utf8'))
  for (const path of [docs['bpc-157'].url, '/catalog/current.json', '/route-manifest.json', '/robots.txt', '/sitemap.xml']) {
    const { response } = await request(path)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control') || '', path === docs['bpc-157'].url ? /immutable/ : /must-revalidate/, path)
  }
  await mkdir('artifacts/seo-validation', { recursive: true })
  await writeFile('artifacts/seo-validation/http-routes.json', JSON.stringify({ compiler: '@vercel/routing-utils', note: 'Local HTTP harness executes compiled Vercel rules; deployed CDN must be rechecked after approval.', results }, null, 2))
  console.log(`Host-aware HTTP QA passed: ${results.length} requests, all 32 product aliases single-hop, private headers, query preservation, genuine 404s and cache policies.`)
} finally { await new Promise((done) => server.close(done)) }
