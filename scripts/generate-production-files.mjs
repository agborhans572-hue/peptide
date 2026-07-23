import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { productionRoutes, SITE_ORIGIN } from './site-routes.mjs'

const xmlEscape = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const sitemapEntries = productionRoutes
  .filter((route) => route.indexable)
  .map((route) => {
    const lastmod = route.lastmod ? `<lastmod>${xmlEscape(route.lastmod)}</lastmod>` : ''
    const image = route.image
      ? `<image:image><image:loc>${xmlEscape(route.image)}</image:loc>${route.imageAlt ? `<image:caption>${xmlEscape(route.imageAlt)}</image:caption>` : ''}</image:image>`
      : ''
    return `  <url><loc>${xmlEscape(new URL(route.path, SITE_ORIGIN).href)}</loc>${lastmod}${image}</url>`
  })
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapEntries}
</urlset>
`

const robots = `User-agent: *
Allow: /
Disallow: /my-account/
Disallow: /auth/
Disallow: /track-my-order/
Disallow: /checkout/
Disallow: /order-confirmation/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`

const serializeRouteMetadata = (routes) => Object.fromEntries(routes.map((route) => [route.path, {
  path: route.path,
  title: route.title,
  description: route.description,
  kind: route.kind,
  indexable: route.indexable,
  image: route.image,
  imageAlt: route.imageAlt,
  imageWidth: route.imageWidth,
  imageHeight: route.imageHeight,
  imageType: route.imageType,
  schema: route.schema,
}]))

const pageRouteMetadata = serializeRouteMetadata(productionRoutes.filter((route) => route.kind !== 'product'))
const productRouteMetadata = serializeRouteMetadata(productionRoutes.filter((route) => route.kind === 'product'))
const catalog = JSON.parse(await readFile(resolve('catalog/catalog.generated.json'), 'utf8'))
const redirectPath = resolve('public/_redirects')
const currentRedirects = await readFile(redirectPath, 'utf8')
const redirectStart = '# BEGIN GENERATED PRODUCT REDIRECTS'
const redirectEnd = '# END GENERATED PRODUCT REDIRECTS'
const withoutGeneratedRedirects = currentRedirects.replace(new RegExp(`${redirectStart}[\\s\\S]*?${redirectEnd}\\n?`, 'g'), '')
const productRedirects = catalog.products.flatMap((product) => product.legacySlugs.map((slug) => `/product/${encodeURI(slug)}/ /product/${product.slug}/ 301!`)).sort()
const generatedRedirects = `${redirectStart}\n${productRedirects.join('\n')}\n${redirectEnd}\n`
const fallbackIndex = withoutGeneratedRedirects.lastIndexOf('/* /index.html 200')
const redirects = fallbackIndex >= 0
  ? `${withoutGeneratedRedirects.slice(0, fallbackIndex)}${generatedRedirects}${withoutGeneratedRedirects.slice(fallbackIndex)}`
  : `${withoutGeneratedRedirects.trimEnd()}\n${generatedRedirects}`

await Promise.all([
  writeFile(resolve('public/sitemap.xml'), sitemap, 'utf8'),
  writeFile(resolve('public/robots.txt'), robots, 'utf8'),
  writeFile(resolve('src/routeMetadata.json'), `${JSON.stringify(pageRouteMetadata, null, 2)}\n`, 'utf8'),
  writeFile(resolve('src/productRouteMetadata.json'), `${JSON.stringify(productRouteMetadata, null, 2)}\n`, 'utf8'),
  writeFile(redirectPath, redirects, 'utf8'),
])

console.log(`Generated sitemap.xml with ${productionRoutes.filter((route) => route.indexable).length} URLs, robots.txt, and client route metadata.`)
