import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { productionRoutes } from './scripts/site-routes.mjs'

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

function routeHtml(source, route) {
  const canonicalUrl = new URL(route.path, 'https://purehealthpeptides.com').href
  const socialImage = route.image || 'https://purehealthpeptides.com/assets/hero-vials.png'
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
