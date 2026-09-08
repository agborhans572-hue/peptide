import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { productionRoutes, SITE_ORIGIN } from './site-routes.mjs'
import { routeManifest } from './route-manifest.mjs'

const xmlEscape = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const sitemapEntries = productionRoutes
  .filter((route) => routeManifest.routes.some((entry) => entry.path === route.path && entry.classification === 'indexable-200' && entry.expectedStatus === 200 && entry.sitemap))
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
# Public sign-in and checkout shells expose noindex. Customer data requires authorization.

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
await Promise.all([
  writeFile(resolve('public/sitemap.xml'), sitemap, 'utf8'),
  writeFile(resolve('public/robots.txt'), robots, 'utf8'),
  writeFile(resolve('src/routeMetadata.json'), `${JSON.stringify(pageRouteMetadata, null, 2)}\n`, 'utf8'),
  writeFile(resolve('src/productRouteMetadata.json'), `${JSON.stringify(productRouteMetadata, null, 2)}\n`, 'utf8'),
])

console.log(`Generated sitemap.xml with ${productionRoutes.filter((route) => route.indexable).length} URLs, robots.txt, and client route metadata.`)
