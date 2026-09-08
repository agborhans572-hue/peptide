import { responsiveImage } from './src/responsiveImages.js'
import { prerenderPages } from './scripts/prerender-pages.mjs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { productionRoutes, SITE_ORIGIN } from './scripts/site-routes.mjs'

function responsiveBackgroundImages() {
  return { name: 'responsive-background-images', enforce: 'pre', transform(source, id) {
    if (!/\.css(?:$|\?)/.test(id)) return null
    const code = source.replace(/url\((['"]?)(\/assets\/[^'")]+)\1\)/g, (match, _quote, path) => responsiveImage(path)?.src ? 'url("' + responsiveImage(path).src + '")' : match)
    return code === source ? null : { code, map: null }
  } }
}

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

function crawlableRouteContent(route, rendered, chrome) {
  const content = rendered?.html || '<article class="policy-page"><h1>' + escapeHtml(pageHeading(route)) + '</h1><p>' + escapeHtml(route.description) + '</p><p>Sign-in and transaction features require JavaScript. Account and order information is available only after the required authorization.</p></article>'
  return '<div class="app-content" data-seo-shell><a class="skip-link" href="#main-content">Skip to main content</a>' + chrome.header + '<main id="main-content" tabindex="-1">' + content + '</main>' + chrome.footer + '</div>'
}

function routeHtml(source, route, rendered, manifest, chrome, stylesheets) {
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
      (_match, prefix, suffix) => prefix + (escapeHtml(canonicalUrl)) + suffix,
    )

  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(route.description)) + suffix,
  )
  html = html.replace(
    /(<link\s+rel="alternate"\s+hreflang="en-US"\s+href=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(canonicalUrl)) + suffix,
  )
  html = html.replace(
    /(<link\s+rel="alternate"\s+hreflang="x-default"\s+href=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(canonicalUrl)) + suffix,
  )
  html = html.replace(
    /(<meta\s+name="robots"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (robots) + suffix,
  )
  html = html.replace(
    /(<meta\s+property="og:type"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (route.kind === 'product' ? 'product' : 'website') + suffix,
  )
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(route.title)) + suffix,
  )
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(route.description)) + suffix,
  )
  html = html.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(canonicalUrl)) + suffix,
  )
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(route.title)) + suffix,
  )
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(route.description)) + suffix,
  )
  html = html.replace(
    /(<meta\s+property="og:image"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(socialImage)) + suffix,
  )
  html = html.replace(
    /(<meta\s+property="og:image:type"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (imageType) + suffix,
  )
  html = html.replace(
    /(<meta\s+property="og:image:width"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (route.imageWidth || 1200) + suffix,
  )
  html = html.replace(
    /(<meta\s+property="og:image:height"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (route.imageHeight || 630) + suffix,
  )
  html = html.replace(
    /(<meta\s+property="og:image:alt"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(route.imageAlt || route.title)) + suffix,
  )
  html = html.replace(
    /(<meta\s+name="twitter:image"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(socialImage)) + suffix,
  )
  html = html.replace(
    /(<meta\s+name="twitter:image:alt"\s+content=")[^"]*("\s*\/?>)/i,
    (_match, prefix, suffix) => prefix + (escapeHtml(route.imageAlt || route.title)) + suffix,
  )
  const entry = route.kind === 'product' ? 'src/ProductDetailPage.jsx' : {
    '/': 'src/HomePage.jsx', '/shop/': 'src/ShopPage.jsx', '/shipping-policy/': 'src/PolicyPages.jsx', '/refund-policy/': 'src/PolicyPages.jsx', '/privacy-policy/': 'src/PolicyPages.jsx', '/terms-and-conditions/': 'src/PolicyPages.jsx',
  }[route.path] || (route.path.startsWith('/coa-library/') ? 'src/CoaLibraryPages.jsx' : ['/about-us/', '/research-areas/', '/news/', '/pure-elite-access/'].includes(route.path) ? 'src/AboutPages.jsx' : ['/faqs/', '/contact-us/'].includes(route.path) ? 'src/SupportPages.jsx' : 'src/PeptideInfoPages.jsx')
  const background = responsiveImage(route.path === '/' ? '/assets/hero-molecule.jpg' : route.path === '/coa-library/' ? '/assets/coa-library/coa-hero.png' : '')
  if (background?.src) html = html.replace('</head>', '<link rel="preload" as="image" fetchpriority="high" href="' + background.src + '"></head>')
  if (route.path === '/') {
    const hero = responsiveImage('/assets/hero-vials.png')
    html = html.replace('</head>', '<link rel="preload" as="image" fetchpriority="high" media="(min-width: 1280px)" href="' + hero.src + '" imagesrcset="' + hero.srcSet + '" imagesizes="600px"></head>')
  }
  const bundle = route.indexable ? manifest[entry] : null
  if (bundle) {
    const links = [...(bundle.css || []).map((file) => '<link rel="stylesheet" href="' + deployBase + file + '">'), '<link rel="modulepreload" href="' + deployBase + bundle.file + '">']
    html = html.replace('</head>', links.join('') + '</head>')
  }
  if (rendered?.document) html = html.replace('</head>', '<script id="product-initial-data" type="application/json">' + jsonForHtml(rendered.document) + '</script></head>')
  if (route.schema) {
    html = html.replace('</head>', `    <script id="seo-jsonld" type="application/ld+json">${jsonForHtml(route.schema)}</script>\n  </head>`)
  }

  html = html.replace('<div id="root"></div>', `<div id="root">${crawlableRouteContent(route, rendered, chrome)}</div>`)

  // Inline the small common/route styles so initial content does not wait on a CSS request chain.
  // Other routes still load their own CSS through Vite's normal dynamic imports.
  html = html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/gi, (tag) => {
    const href = tag.match(/href="([^"]+)"/)?.[1]
    return stylesheets.has(href) ? '<style data-route-css="' + escapeHtml(href) + '">' + stylesheets.get(href) + '</style>' : tag
  })
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
      const renderedPages = await prerenderPages()
      const manifest = JSON.parse(await readFile(resolve(outputDirectory, '.vite/manifest.json'), 'utf8'))
      const stylesheets = new Map(await Promise.all([...new Set(Object.values(manifest).flatMap((entry) => entry.css || []))].map(async (file) => [deployBase + file, await readFile(resolve(outputDirectory, file), 'utf8')])))
      const homeRoute = productionRoutes.find((route) => route.path === '/')

      if (homeRoute) {
        await writeFile(resolve(outputDirectory, 'index.html'), routeHtml(source, homeRoute, renderedPages.get(homeRoute.path), manifest, renderedPages.get('chrome'), stylesheets), 'utf8')
      }

      await Promise.all(
        productionRoutes
          .filter((route) => route.path !== '/')
          .map(async (route) => {
            const routeDirectory = decodeURIComponent(route.path.replace(/^\/+|\/+$/g, ''))
            const destination = resolve(outputDirectory, routeDirectory, 'index.html')
            await mkdir(dirname(destination), { recursive: true })
            await writeFile(destination, routeHtml(source, route, renderedPages.get(route.path), manifest, renderedPages.get('chrome'), stylesheets), 'utf8')
          }),
      )
    },
  }
}

const deployBase = normalizedBasePath(process.env.VITE_DEPLOY_BASE)

export default defineConfig({
  base: deployBase,
  plugins: [react(), responsiveBackgroundImages(), rebasePublicAssetReferences(deployBase), emitRouteHtmlPlugin()],
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
    manifest: true,
    cssCodeSplit: true,
    minify: 'oxc',
    sourcemap: process.env.VITE_BUILD_SOURCEMAP === 'true',
    reportCompressedSize: true,
  },
})
