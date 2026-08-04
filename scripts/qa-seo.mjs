import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { productionRoutes, SITE_ORIGIN } from './site-routes.mjs'

const CANONICAL_PRODUCTION_ORIGIN = 'https://purehealthpeptidesshop.com'
const errors = []

function check(condition, message) {
  if (!condition) errors.push(message)
}

function decodeHtml(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function tagValue(html, pattern) {
  return decodeHtml(html.match(pattern)?.[1]?.trim() || '')
}

function routeFile(route) {
  if (route.path === '/') return resolve('dist/index.html')
  const directory = decodeURIComponent(route.path.replace(/^\/+|\/+$/g, ''))
  return resolve('dist', directory, 'index.html')
}

check(
  SITE_ORIGIN === CANONICAL_PRODUCTION_ORIGIN,
  `production origin is ${SITE_ORIGIN}; expected ${CANONICAL_PRODUCTION_ORIGIN}`,
)

const indexableRoutes = productionRoutes.filter((route) => route.indexable)
const titles = new Map()
const descriptions = new Map()

for (const route of productionRoutes) {
  const html = await readFile(routeFile(route), 'utf8')
  const expectedUrl = new URL(route.path, SITE_ORIGIN).href
  const title = tagValue(html, /<title>([^<]*)<\/title>/i)
  const description = tagValue(html, /<meta\s+name="description"\s+content="([^"]*)"/i)
  const canonical = tagValue(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i)
  const robots = tagValue(html, /<meta\s+name="robots"\s+content="([^"]*)"/i)
  const ogUrl = tagValue(html, /<meta\s+property="og:url"\s+content="([^"]*)"/i)
  const ogImage = tagValue(html, /<meta\s+property="og:image"\s+content="([^"]*)"/i)
  const alternate = tagValue(html, /<link\s+rel="alternate"\s+hreflang="en-US"\s+href="([^"]*)"/i)
  const jsonLd = html.match(/<script\s+id="seo-jsonld"\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1]

  check(title === route.title, `${route.path}: title does not match route metadata`)
  check(description === route.description, `${route.path}: description does not match route metadata`)
  check(canonical === expectedUrl, `${route.path}: canonical URL is incorrect`)
  check(ogUrl === expectedUrl, `${route.path}: Open Graph URL is incorrect`)
  check(alternate === expectedUrl, `${route.path}: en-US alternate URL is incorrect`)
  check(ogImage.startsWith(`${SITE_ORIGIN}/`), `${route.path}: social image is not an absolute first-party URL`)
  check(route.indexable ? robots.startsWith('index, follow') : robots === 'noindex, nofollow', `${route.path}: robots directive is incorrect`)
  check(title.length >= 25 && title.length <= 65, `${route.path}: title length ${title.length} is outside 25–65 characters`)
  if (route.indexable) check(description.length >= 70 && description.length <= 160, `${route.path}: description length ${description.length} is outside 70–160 characters`)
  check(Boolean(jsonLd), `${route.path}: initial HTML is missing JSON-LD`)

  if (jsonLd) {
    try {
      const schema = JSON.parse(jsonLd)
      const graph = Array.isArray(schema['@graph']) ? schema['@graph'] : []
      check(schema['@context'] === 'https://schema.org', `${route.path}: JSON-LD context is incorrect`)
      check(graph.some((node) => ['WebPage', 'CollectionPage'].includes(node['@type'])), `${route.path}: JSON-LD is missing a page entity`)
      if (route.kind === 'product') {
        const product = graph.find((node) => node['@type'] === 'Product')
        check(Boolean(product), `${route.path}: JSON-LD is missing Product markup`)
        check(Boolean(product?.offers), `${route.path}: Product markup is missing offers`)
        check(graph.some((node) => node['@type'] === 'BreadcrumbList'), `${route.path}: JSON-LD is missing breadcrumbs`)
      }
    } catch (error) {
      errors.push(`${route.path}: JSON-LD is invalid (${error.message})`)
    }
  }

  if (route.indexable) {
    const titleOwner = titles.get(title)
    check(!titleOwner, `${route.path}: title duplicates ${titleOwner}`)
    titles.set(title, route.path)
    const descriptionOwner = descriptions.get(description)
    check(!descriptionOwner, `${route.path}: description duplicates ${descriptionOwner}`)
    descriptions.set(description, route.path)
  }
}

const sitemap = await readFile(resolve('dist/sitemap.xml'), 'utf8')
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeHtml(match[1]))
check(sitemapUrls.length === indexableRoutes.length, `sitemap has ${sitemapUrls.length} URLs; expected ${indexableRoutes.length}`)
for (const route of indexableRoutes) {
  check(sitemapUrls.includes(new URL(route.path, SITE_ORIGIN).href), `${route.path}: missing from sitemap`)
}
for (const route of productionRoutes.filter((route) => !route.indexable)) {
  check(!sitemapUrls.includes(new URL(route.path, SITE_ORIGIN).href), `${route.path}: noindex route appears in sitemap`)
}

const robots = await readFile(resolve('dist/robots.txt'), 'utf8')
check(robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`), 'robots.txt is missing the sitemap URL')
check(robots.includes('Disallow: /checkout/'), 'robots.txt does not block checkout')
check(robots.includes('Disallow: /order-confirmation/'), 'robots.txt does not block order confirmation')

if (errors.length) {
  console.error(`SEO QA failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`)
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log(`SEO QA passed: ${productionRoutes.length} route shells, ${indexableRoutes.length} sitemap URLs, unique titles/descriptions, and valid page/product JSON-LD.`)
