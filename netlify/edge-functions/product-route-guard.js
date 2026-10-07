import access from '../../catalog/product-route-access.generated.js'

function cleanSlug(value) {
  try { return decodeURIComponent(String(value || '')).normalize('NFC').toLowerCase() } catch { return '' }
}

function page(status, title) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${title}</title></head><body><main><h1>${title}</h1><p><a href="/shop/">Return to the shop</a></p></main></body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate', 'x-robots-tag': 'noindex, nofollow' },
  })
}

export function createProductRouteGuard(manifest) {
  const published = new Set(manifest.published)
  const retired = new Set(manifest.retired.flatMap((item) => typeof item === 'string' ? [cleanSlug(item)] : [item.slug, ...(item.legacySlugs || [])].map(cleanSlug)))
  return async (request, context) => {
  const url = new URL(request.url)
  const match = url.pathname.match(/^\/product\/([^/]+)(?:\/index\.html|\/)?$/i)
  if (!match) return context.next()
  let decoded
  try { decoded = decodeURIComponent(match[1]) } catch { return page(404, 'Product not found') }
  const slug = cleanSlug(decoded)
  const canonical = manifest.redirects[slug]
  if (canonical && canonical !== slug) {
    url.pathname = `/product/${canonical}/`
    return Response.redirect(url, 301)
  }
  if (published.has(slug)) {
    const canonicalPath = '/product/' + slug + '/'
    if (url.pathname !== canonicalPath) { url.pathname = canonicalPath; return Response.redirect(url, 301) }
    return context.next()
  }
  if (retired.has(slug)) return page(410, 'Product retired')
  return page(404, 'Product not found')
  }
}

export default createProductRouteGuard(access)
