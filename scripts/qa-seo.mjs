import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { JSDOM } from 'jsdom'
import { productionRoutes, SITE_ORIGIN } from './site-routes.mjs'
import { routeManifest } from './route-manifest.mjs'

const errors = []
const check = (ok, message) => { if (!ok) errors.push(message) }
const titles = new Set(), descriptions = new Set(), graph = new Map()
const docs = JSON.parse(await readFile('src/productDocumentManifest.json', 'utf8'))
const indexable = productionRoutes.filter((r) => r.indexable)
for (const route of productionRoutes) {
  const file = resolve('dist', '.' + decodeURIComponent(route.path), 'index.html')
  const html = await readFile(file, 'utf8')
  // JSDOM does not execute scripts or load subresources here.
  const dom = new JSDOM(html), document = dom.window.document
  const value = (selector, attribute = 'content') => document.querySelector(selector)?.getAttribute(attribute)
  const prefix = route.path + ': '
  const canonical = new URL(route.path, SITE_ORIGIN).href
  check(document.querySelectorAll('title').length === 1 && document.querySelector('title').textContent === route.title, prefix + 'unique matching title')
  check(value('meta[name="description"]') === route.description, prefix + 'matching description')
  check(value('link[rel="canonical"]', 'href') === canonical, prefix + 'canonical')
  check(value('meta[property="og:url"]') === canonical, prefix + 'Open Graph URL')
  check(value('meta[property="og:type"]') === (route.kind === 'product' ? 'product' : 'website'), prefix + 'Open Graph type')
  check(Number(value('meta[property="og:image:width"]')) > 0 && Number(value('meta[property="og:image:height"]')) > 0, prefix + 'social image dimensions')
  check(value('meta[name="robots"]')?.startsWith(route.indexable ? 'index, follow' : 'noindex, nofollow'), prefix + 'robots')
  check(document.querySelectorAll('h1').length === 1, prefix + 'exactly one H1')
  const main = document.querySelector('main')
  check(main?.textContent.trim().length > (route.indexable ? 250 : 50), prefix + 'substantive main content')
  check(!/Page not found|Product not found|Loading product/.test(main?.textContent || ''), prefix + 'no soft 404 or loading-only content')
  const links = [...document.querySelectorAll('a[href]')].map((a) => new URL(a.getAttribute('href'), canonical)).filter((url) => url.origin === SITE_ORIGIN).map((url) => url.pathname)
  graph.set(route.path, [...new Set(links)])
  check(links.includes('/shop/'), prefix + 'crawlable shop link')
  for (const anchor of document.querySelectorAll('a')) {
    check(Boolean(anchor.getAttribute('href')), prefix + 'crawlable anchor destination: ' + anchor.textContent.trim())
    check(Boolean(anchor.textContent.trim() || anchor.getAttribute('aria-label') || anchor.querySelector('img[alt]')?.getAttribute('alt')), prefix + 'accessible link name')
  }
  const schema = JSON.parse(document.querySelector('#seo-jsonld')?.textContent || 'null')
  check(schema?.['@context'] === 'https://schema.org', prefix + 'JSON-LD context')
  const nodes = schema?.['@graph'] || []
  check(nodes.some((n) => ['WebPage', 'CollectionPage'].includes(n['@type']) && n.url === canonical), prefix + 'route-specific page schema')
  const products = nodes.filter((n) => n['@type'] === 'Product')
  if (route.kind === 'product') {
    check(products.length === 1 && products[0].name === route.product.name && products[0].url === canonical, prefix + 'correct Product schema')
    check(Boolean(products[0]?.offers), prefix + 'offers')
    check(!products[0]?.review && !products[0]?.aggregateRating, prefix + 'no invented reviews')
    check(nodes.some((n) => n['@type'] === 'BreadcrumbList'), prefix + 'breadcrumbs')
    const seed = JSON.parse(document.querySelector('#product-initial-data')?.textContent || 'null')
    const documentBytes = await readFile('public' + docs[route.product.slug].url, 'utf8')
    check(JSON.stringify(seed) === JSON.stringify(JSON.parse(documentBytes)), prefix + 'HTML seed equals immutable product document')
    check(docs[route.product.slug].url.includes(createHash('sha256').update(JSON.stringify(seed)).digest('hex').slice(0, 20)), prefix + 'content and metadata hash')
    check(seed?.productId === route.product.id, prefix + 'stable product ID')
    check(seed?.detail.documentTitle === route.title, prefix + 'no stale detail document title')
    check(document.querySelectorAll('.product-gallery').length === 1, prefix + 'single responsive gallery')
    const related = [...document.querySelectorAll('.product-related-grid > a')].map((a) => a.getAttribute('href'))
    check(JSON.stringify(related) === JSON.stringify(route.relatedPaths), prefix + 'shared related product selection')
  } else check(products.length === 0 && !document.querySelector('#product-initial-data'), prefix + 'no stale product data')
  if (!route.indexable) check(!document.querySelector('input') && !/customer_id|access_token|stripe_session/.test(main.textContent), prefix + 'safe private shell')
  if (route.indexable) {
    check(!titles.has(document.title), prefix + 'title duplicate'); titles.add(document.title)
    check(!descriptions.has(route.description), prefix + 'description duplicate'); descriptions.add(route.description)
    for (const img of document.querySelectorAll('img')) check(Number(img.width) > 0 && Number(img.height) > 0, prefix + 'image dimensions: ' + img.getAttribute('src'))
  }
  dom.window.close()
}
const distance = new Map([['/', 0]])
for (const [path, depth] of distance) for (const next of graph.get(path) || []) if (graph.has(next) && !distance.has(next)) distance.set(next, depth + 1)
for (const route of indexable) check(distance.has(route.path) && distance.get(route.path) <= 2, route.path + ': reachable within two links from home')
const sitemap = await readFile('dist/sitemap.xml', 'utf8')
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
check(urls.length === 136 && new Set(urls).size === 136, '136 unique sitemap entries')
for (const url of urls) {
  const parsed = new URL(url)
  check(parsed.origin === SITE_ORIGIN && !parsed.search, url + ': canonical origin without query')
  check(routeManifest.routes.some((r) => r.path === parsed.pathname && r.classification === 'indexable-200' && r.sitemap), url + ': indexable canonical 200')
}
const robots = await readFile('dist/robots.txt', 'utf8')
check(robots.includes('Sitemap: ' + SITE_ORIGIN + '/sitemap.xml') && !/^Disallow:\s*\/(?:my-account|auth|checkout|track-my-order|order-confirmation)/m.test(robots), 'private noindex remains crawlable')
const org = productionRoutes[0].schema['@graph'].find((n) => n['@type'] === 'Organization')
check(org?.hasMerchantReturnPolicy?.merchantReturnLink === SITE_ORIGIN + '/refund-policy/', 'organization return-policy link')
check(Object.keys(org?.hasMerchantReturnPolicy || {}).every((key) => ['@type', 'merchantReturnLink'].includes(key)), 'no invented return window, fees or eligibility')
await mkdir('artifacts/seo-validation', { recursive: true })
await writeFile('artifacts/seo-validation/initial-html.json', JSON.stringify({ routes: productionRoutes.length, sitemap: urls.length, crawlDepths: Object.fromEntries(distance), errors }, null, 2))
if (errors.length) throw new Error(errors.join('\n'))
console.log(`Initial HTML QA passed: ${productionRoutes.length} pages, ${urls.length} sitemap URLs, no orphans, maximum two links from homepage; scripts never executed.`)
