import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { loadPageImages } from './qa-image-loading.mjs'

const baseUrl = process.env.SHOP_QA_URL || 'http://127.0.0.1:4173'
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const manifestPath = path.resolve(import.meta.dirname, '..', 'docs', 'seo', 'route-manifest.json')
const outputPath = path.resolve(import.meta.dirname, '..', 'preview', 'image-layout-qa', 'results.json')
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const desktopRoutes = manifest.routes
  .filter((route) => route.expectedStatus === 200 && ['indexable-200', 'private-noindex'].includes(route.classification))
  .map((route) => route.path)

const mobileRoutes = [
  '/',
  '/shop/',
  '/product/bpc-157/',
  '/product/bpc-157-arginate-salt/',
  '/product/bpc-157-liquid/',
  '/product/modular-peptide-system-a-dual-peptide-serum/',
  '/about-us/',
  '/research-areas/',
  '/news/',
  '/pure-elite-access/',
  '/info-cards/',
  '/coa-process/',
  '/manufacturing/',
  '/dilution-guide/',
  '/coa-library/',
  '/coa-library/vials/',
  '/shipping-policy/',
  '/my-account/',
  '/checkout/',
]

const viewports = [
  { label: 'desktop', width: 1440, height: 1000, routes: desktopRoutes },
  { label: 'mobile', width: 390, height: 844, routes: mobileRoutes },
]

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const results = []
const failures = []

try {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => localStorage.setItem('php-research-confirmed', 'true'))

  for (const viewport of viewports) {
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })

    for (const route of viewport.routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0', timeout: 30_000 })
      await loadPageImages(page)

      const audit = await page.evaluate(() => {
        const broken = []
        const distorted = []
        const oversized = []
        let visibleImages = 0

        for (const [index, image] of [...document.images].entries()) {
          if (!image.complete || image.naturalWidth === 0) {
            broken.push(image.currentSrc || image.src)
            continue
          }

          const rect = image.getBoundingClientRect()
          if (rect.width < 1 || rect.height < 1) continue
          visibleImages += 1

          const style = getComputedStyle(image)
          const identifier = image.className || image.alt || image.currentSrc || `image ${index + 1}`
          const naturalRatio = image.naturalWidth / image.naturalHeight
          const renderedRatio = rect.width / rect.height
          const ratioError = Math.abs(renderedRatio / naturalRatio - 1)
          const expectedHeight = rect.width / naturalRatio
          const heightDelta = Math.abs(rect.height - expectedHeight)

          if (style.objectFit === 'fill' && ratioError > 0.03 && heightDelta > 2) {
            distorted.push({
              identifier,
              rendered: [Math.round(rect.width), Math.round(rect.height)],
              natural: [image.naturalWidth, image.naturalHeight],
              ratioError: Number(ratioError.toFixed(3)),
            })
          }

          if (rect.width > document.documentElement.clientWidth + 1 || (rect.height > 1200 && rect.height > rect.width * 3)) {
            oversized.push({ identifier, rendered: [Math.round(rect.width), Math.round(rect.height)] })
          }
        }

        return { visibleImages, broken, distorted, oversized }
      })

      const routeFailures = [
        ...audit.broken.map((value) => `broken: ${value}`),
        ...audit.distorted.map((value) => `distorted: ${JSON.stringify(value)}`),
        ...audit.oversized.map((value) => `oversized: ${JSON.stringify(value)}`),
      ]
      if (routeFailures.length) failures.push(`${viewport.label} ${route}\n${routeFailures.join('\n')}`)

      results.push({ viewport: viewport.label, route, visibleImages: audit.visibleImages })
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2))
  if (failures.length) throw new Error(`Image layout failures:\n${failures.join('\n\n')}`)
  const imageCount = results.reduce((sum, result) => sum + result.visibleImages, 0)
  console.log(`Image layout QA passed: ${desktopRoutes.length} desktop routes, ${mobileRoutes.length} mobile page types, ${imageCount} visible image instances.`)
} finally {
  await browser.close()
}
