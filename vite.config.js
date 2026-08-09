import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { productionRoutes, SITE_ORIGIN } from './scripts/site-routes.mjs'

function normalizedBasePath(value) {
  if (!value) return '/'
  return `/${value.replace(/^\/+|\/+$/g, '')}/`
}

function rebasePublicAssetReferences(base) {
  if (base === '/') return { name: 'rebase-public-asset-references' }

  return {
    name: 'rebase-public-asset-references',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        output.code = output.code.replace(/(["'])\/(assets|_product-media)\//g, `$1${base}$2/`)
      }
    },
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function jsonForHtml(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

function pageHeading(route) {
  if (route.crawlContent?.heading) return route.crawlContent.heading
  return route.title.split(' | ')[0].trim()
}

function trimAtWord(value, maximumLength) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maximumLength) return normalized
  return `${normalized.slice(0, maximumLength - 1).replace(/\s+\S*$/, '')}…`
}

function renderLinkList(routes, className = '') {
  return `<ul${className ? ` class="${className}"` : ''}>${routes.map((item) => (
    `<li><a href="${escapeHtml(item.path)}">${escapeHtml(pageHeading(item))}</a></li>`
  )).join('')}</ul>`
}

function crawlableRouteContent(route) {
  const indexableRoutes = productionRoutes.filter((item) => item.indexable)
  const productRoutes = indexableRoutes.filter((item) => item.kind === 'product')
  const pageRoutes = indexableRoutes.filter((item) => item.kind !== 'product')
  const corePaths = new Set(['/', '/shop/', '/coa-library/', '/info-cards/', '/about-us/', '/faqs/', '/contact-us/'])
  const coreRoutes = pageRoutes.filter((item) => corePaths.has(item.path))
  const productIndex = productRoutes.findIndex((item) => item.path === route.path)
  const relatedProducts = productIndex < 0
    ? productRoutes.slice(0, route.path === '/shop/' ? productRoutes.length : 12)
    : Array.from({ length: Math.min(6, Math.max(0, productRoutes.length - 1)) }, (_, offset) => (
      productRoutes[(productIndex + offset + 1) % productRoutes.length]
    ))
  const isProduct = route.kind === 'product'
  const productDetails = isProduct ? route.crawlContent : null
  const optionList = productDetails?.options?.length
    ? `<section><h2>Available research formats</h2><ul>${productDetails.options.map((option) => (
      `<li>${escapeHtml(option.label)} — $${escapeHtml(option.price)} USD${option.available ? '' : ' — currently unavailable'}</li>`
    )).join('')}</ul></section>`
    : ''
  const categoryList = productDetails?.categories?.length
    ? `<p><strong>Research areas:</strong> ${escapeHtml(productDetails.categories.join(', '))}</p>`
    : ''
  const routeCopy = isProduct
    ? `<p>${escapeHtml(trimAtWord(productDetails?.description || route.description, 3200))}</p>${categoryList}${optionList}`
    : `<p>${escapeHtml(route.description)}</p>`
  const productImage = isProduct
    ? `<img class="seo-static-product-image" src="${escapeHtml(new URL(route.image, SITE_ORIGIN).pathname)}" alt="${escapeHtml(route.imageAlt || pageHeading(route))}" width="600" height="600" />`
    : ''
  const directory = route.path === '/shop/'
    ? `<section><h2>Browse the research catalog</h2>${renderLinkList(productRoutes, 'seo-static-product-list')}</section>`
    : relatedProducts.length
      ? `<section><h2>${isProduct ? 'Related research materials' : 'Popular research materials'}</h2>${renderLinkList(relatedProducts, 'seo-static-related-list')}</section>`
      : ''

  return `<div class="seo-static-shell" data-seo-shell>
      <header class="seo-static-header">
        <a class="seo-static-brand" href="/">Pure Health Peptides</a>
        <nav aria-label="Primary">${coreRoutes.map((item) => `<a href="${escapeHtml(item.path)}">${escapeHtml(pageHeading(item))}</a>`).join('')}</nav>
      </header>
      <main>
        <article>
          <p class="seo-static-eyebrow">Independently batch-tested research materials</p>
          <h1>${escapeHtml(pageHeading(route))}</h1>
          ${productImage}
          ${routeCopy}
          ${isProduct ? '<p><a href="/coa-library/">Search the Certificate of Analysis library</a> for batch-specific test documentation.</p>' : ''}
          ${directory}
        </article>
      </main>
      <footer>
        <p>For controlled in vitro laboratory research only. Not for human or veterinary use.</p>
        <nav aria-label="Footer">${coreRoutes.map((item) => `<a href="${escapeHtml(item.path)}">${escapeHtml(pageHeading(item))}</a>`).join('')}</nav>
      </footer>
    </div>`
}

const crawlableShellStyles = `<style id="seo-shell-style">
      .seo-static-shell{min-height:100vh;background:#f7f8fa;color:#0a1d35;font-family:Poppins,Arial,sans-serif;line-height:1.65}
      .seo-static-shell a{color:#0b6574}.seo-static-header,.seo-static-shell main,.seo-static-shell footer{padding:24px clamp(20px,5vw,72px)}
      .seo-static-header{display:flex;align-items:center;justify-content:space-between;gap:24px;background:#071a31;color:#fff}
      .seo-static-brand{color:#fff!important;font-size:1.2rem;font-weight:700;text-decoration:none}.seo-static-header nav,.seo-static-shell footer nav{display:flex;flex-wrap:wrap;gap:10px 20px}
      .seo-static-header nav a{color:#fff}.seo-static-shell article{max-width:1120px;margin:0 auto}.seo-static-shell h1{font-size:clamp(2rem,5vw,4rem);line-height:1.1}
      .seo-static-eyebrow{text-transform:uppercase;letter-spacing:.08em;font-weight:700}.seo-static-product-image{display:block;max-width:min(100%,420px);height:auto;margin:24px 0}
      .seo-static-product-list{columns:3;column-gap:32px}.seo-static-product-list li{break-inside:avoid;margin-bottom:8px}.seo-static-related-list{columns:2}
      .seo-static-shell footer{background:#071a31;color:#fff}.seo-static-shell footer a{color:#fff}@media(max-width:760px){.seo-static-header{align-items:flex-start;flex-direction:column}.seo-static-product-list,.seo-static-related-list{columns:1}}
    </style>`

function routeHtml(source, route) {
  const canonicalUrl = new URL(route.path, SITE_ORIGIN).href
  const socialImage = route.image || `${SITE_ORIGIN}/assets/hero-vials.png`
  const imageType = route.imageType || (/\.png(?:$|\?)/i.test(socialImage) ? 'image/png' : /\.webp(?:$|\?)/i.test(socialImage) ? 'image/webp' : 'image/jpeg')
  const robots = route.indexable
    ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    : 'noindex, nofollow'

  let html = source
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(route.title)}</title>`)
    .replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/?>)/i,
      `$1${escapeHtml(canonicalUrl)}$2`,
    )

  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(route.description)}$2`,
  )
  html = html.replace(
    /(<link\s+rel="alternate"\s+hreflang="en-US"\s+href=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(canonicalUrl)}$2`,
  )
  html = html.replace(
    /(<link\s+rel="alternate"\s+hreflang="x-default"\s+href=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(canonicalUrl)}$2`,
  )
  html = html.replace(
    /(<meta\s+name="robots"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${robots}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:type"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${route.kind === 'product' ? 'product' : 'website'}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(route.title)}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(route.description)}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(canonicalUrl)}$2`,
  )
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(route.title)}$2`,
  )
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(route.description)}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:image"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(socialImage)}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:image:type"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${imageType}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:image:width"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${route.imageWidth || 1200}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:image:height"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${route.imageHeight || 630}$2`,
  )
  html = html.replace(
    /(<meta\s+property="og:image:alt"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(route.imageAlt || route.title)}$2`,
  )
  html = html.replace(
    /(<meta\s+name="twitter:image"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(socialImage)}$2`,
  )
  html = html.replace(
    /(<meta\s+name="twitter:image:alt"\s+content=")[^"]*("\s*\/?>)/i,
    `$1${escapeHtml(route.imageAlt || route.title)}$2`,
  )
  if (route.schema) {
    html = html.replace('</head>', `    <script id="seo-jsonld" type="application/ld+json">${jsonForHtml(route.schema)}</script>\n  </head>`)
  }

  html = html.replace('</head>', `    ${crawlableShellStyles}\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${crawlableRouteContent(route)}</div>`)

  return html
}

function emitRouteHtmlPlugin() {
  return {
    name: 'emit-route-html',
    apply: 'build',
    enforce: 'post',
    async writeBundle(outputOptions) {
      const outputDirectory = resolve(outputOptions.dir || 'dist')
      const source = await readFile(resolve(outputDirectory, 'index.html'), 'utf8')
      const homeRoute = productionRoutes.find((route) => route.path === '/')

      if (homeRoute) {
        await writeFile(resolve(outputDirectory, 'index.html'), routeHtml(source, homeRoute), 'utf8')
      }

      await Promise.all(
        productionRoutes
          .filter((route) => route.path !== '/')
          .map(async (route) => {
            const routeDirectory = decodeURIComponent(route.path.replace(/^\/+|\/+$/g, ''))
            const destination = resolve(outputDirectory, routeDirectory, 'index.html')
            await mkdir(dirname(destination), { recursive: true })
            await writeFile(destination, routeHtml(source, route), 'utf8')
          }),
      )
    },
  }
}

const deployBase = normalizedBasePath(process.env.VITE_DEPLOY_BASE)

export default defineConfig({
  base: deployBase,
  plugins: [react(), rebasePublicAssetReferences(deployBase), emitRouteHtmlPlugin()],
  server: {
    host: '127.0.0.1',
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    strictPort: true,
  },
  build: {
    target: 'es2020',
    assetsDir: '_app',
    cssCodeSplit: true,
    minify: 'oxc',
    sourcemap: process.env.VITE_BUILD_SOURCEMAP === 'true',
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/')) return 'vendor'
          return undefined
        },
      },
    },
  },
})
