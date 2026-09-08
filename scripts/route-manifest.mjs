import { readFileSync } from 'node:fs'
import { productionRoutes } from './site-routes.mjs'

const catalog = JSON.parse(readFileSync(new URL('../catalog/catalog.generated.json', import.meta.url), 'utf8'))
const entries = new Map()
function add(entry) {
  const key = entry.path || entry.pattern
  const previous = entries.get(key)
  if (previous && previous.canonical !== entry.canonical) throw new Error(`Conflicting route ${key}`)
  entries.set(key, entry)
}
export function encodedSlug(slug) {
  try { return encodeURIComponent(decodeURIComponent(slug).normalize('NFC')) } catch { return encodeURIComponent(slug) }
}
function redirect(path, canonical, observedStatus = null) {
  if (decodeURIComponent(path) === decodeURIComponent(canonical)) return
  add({ path, classification: 'permanent-redirect', expectedStatus: 308, observedStatus, canonical, robots: null, sitemap: false })
}
for (const route of productionRoutes) {
  add({ path: route.path, classification: route.indexable ? 'indexable-200' : 'private-noindex', expectedStatus: 200, observedStatus: route.path === '/product/n-acetyl-semax-amidate/' ? 404 : 200, canonical: route.path, robots: route.indexable ? 'index, follow' : 'noindex, nofollow', sitemap: Boolean(route.indexable), kind: route.kind })
  if (route.path !== '/') redirect(route.path.slice(0, -1), route.path, route.path === '/shop/' ? 200 : null)
  redirect(`${route.path}index.html`, route.path)
}
export const productAliases = catalog.products.flatMap((product) => product.legacySlugs.map((slug) => ({ path: `/product/${encodedSlug(slug)}/`, canonical: `/product/${product.slug}/` })))
for (const alias of productAliases) {
  for (const source of [alias.path, alias.path.slice(0, -1), `${alias.path}index.html`]) {
    redirect(source, alias.canonical, source === alias.path ? (alias.path.includes('n-acetyl-semx-amidate') ? 200 : 404) : null)
  }
}
for (const format of ['vials', 'capsules', 'liquids', 'topicals']) {
  redirect(`/product-form/${format}`, '/shop/')
  redirect(`/product-form/${format}/`, '/shop/')
  add({ pattern: `/product-form/${format}/*/`, classification: 'permanent-redirect', expectedStatus: 308, observedStatus: null, canonical: '/shop/', robots: null, sitemap: false })
  add({ pattern: `/product-form/${format}/*`, classification: 'permanent-redirect', expectedStatus: 308, observedStatus: null, canonical: '/shop/', robots: null, sitemap: false })
}
for (const path of ['/cart/', '/cart', '/not-a-real-page/', '/product/not-a-real-product/']) {
  add({ path, classification: 'genuine-404', expectedStatus: 404, observedStatus: path === '/cart/' ? 404 : null, canonical: null, robots: 'noindex, nofollow', sitemap: false })
}
add({ path: '/404.html', classification: 'private-noindex', expectedStatus: 200, observedStatus: null, canonical: null, robots: 'noindex, nofollow', sitemap: false, kind: 'error-template' })
add({ pattern: '/*', classification: 'genuine-404', expectedStatus: 404, observedStatus: null, canonical: null, robots: 'noindex, nofollow', sitemap: false })
export const routeManifest = {
  observedAt: '2026-09-08',
  observationNote: 'Pre-change production responses; null means not individually measured. Expected responses require local host-aware QA and post-deployment verification.',
  counts: { canonicalProducts: 115, otherPublicPages: 21, errorTemplates: 1, indexable: productionRoutes.filter((r) => r.indexable).length, private: productionRoutes.filter((r) => !r.indexable).length, pageValidations: productionRoutes.length, productAliases: productAliases.length },
  routes: [...entries.values()],
  apiEndpoints: ['/api/checkout', '/api/contact', '/api/client-error', '/api/orders/track', '/api/orders/status', '/api/account/delete-request', '/api/stripe-webhook', '/api/woocommerce-webhook', '/api/cron/process-commerce-jobs', '/api/cron/process-account-deletions'].map((path) => ({ path, sitemap: false, robots: 'noindex, nofollow', cache: 'private, no-store', access: 'Existing endpoint authentication, signature, rate-limit and method checks apply.' })),
}
