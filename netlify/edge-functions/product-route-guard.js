import access from '../../catalog/product-route-access.generated.js'

function cleanSlug(value) {
  return String(value || '')
    .replaceAll('β', ' beta ')
    .replaceAll('Β', ' beta ')
    .replaceAll('⁺', ' plus ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function page(status, title) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${title}</title></head><body><main><h1>${title}</h1><p><a href="/shop/">Return to the shop</a></p></main></body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' },
  })
}

export function createProductRouteGuard(manifest) {
  const published = new Set(manifest.published)
  const retired = new Set(manifest.retired.flatMap((item) => typeof item === 'string' ? [cleanSlug(item)] : [item.slug, ...(item.legacySlugs || [])].map(cleanSlug)))
  return async (request, context) => {
  const url = new URL(request.url)
  const match = url.pathname.match(/^\/product\/([^/]+)\/?$/i)
  if (!match) return context.next()
  let decoded
  try { decoded = decodeURIComponent(match[1]) } catch { return page(404, 'Product not found') }
  const slug = cleanSlug(decoded)
  const canonical = manifest.redirects[slug]
  if (canonical && canonical !== slug) {
    url.pathname = `/product/${canonical}/`
    return Response.redirect(url, 301)
  }
  if (published.has(slug)) return context.next()
  if (retired.has(slug)) return page(410, 'Product retired')
  return page(404, 'Product not found')
  }
}

export default createProductRouteGuard(access)
