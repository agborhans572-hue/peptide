import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'

const root = path.resolve(import.meta.dirname, '..')
const host = process.env.PRODUCTION_QA_HOST || '127.0.0.1'
const port = Number(process.env.PRODUCTION_QA_PORT || 4174)
const baseUrl = `http://${host}:${port}`
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

const routeSets = [
  {
    viewport: { width: 1440, height: 900 },
    routes: [
      '/',
      '/shop/',
      '/about-us/',
      '/contact-us/',
      '/shipping-policy/',
      '/refund-policy/',
      '/privacy-policy/',
      '/terms-and-conditions/',
      '/checkout/',
      '/order-confirmation/',
      '/info-cards/',
      '/coa-library/',
      '/product/bpc-157/',
      '/product/bpc-157-arginate-salt/',
      '/product/bpc-157-liquid/',
      '/product/modular-peptide-system-a-dual-peptide-serum/',
      '/product/not-a-real-product/',
      '/not-a-real-page/',
    ],
  },
  {
    viewport: { width: 390, height: 844 },
    routes: ['/', '/shop/', '/checkout/', '/order-confirmation/', '/privacy-policy/', '/coa-library/', '/product/bpc-157/'],
  },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function waitForServer(processHandle) {
  const timeoutAt = Date.now() + 20_000
  while (Date.now() < timeoutAt) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Vite preview exited early with code ${processHandle.exitCode}.`)
    }
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${baseUrl}.`)
}

await fs.access(path.join(root, 'dist', 'index.html')).catch(() => {
  throw new Error('No production artifact found. Run `npm run build` first.')
})

const preview = spawn(process.execPath, [
  viteBin,
  'preview',
  '--host', host,
  '--port', String(port),
  '--strictPort',
], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})

let previewErrors = ''
preview.stderr.on('data', (chunk) => { previewErrors += chunk.toString() })

let browser
try {
  await waitForServer(preview)

  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const results = []
  for (const routeSet of routeSets) {
    const page = await browser.newPage()
    await page.setCacheEnabled(false)
    await page.setViewport({ ...routeSet.viewport, deviceScaleFactor: 1 })
    await page.evaluateOnNewDocument(() => localStorage.setItem('php-research-confirmed', 'true'))

    const runtimeErrors = []
    const failedRequests = []
    page.on('pageerror', (error) => runtimeErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text())
    })
    page.on('requestfailed', (request) => {
      if (request.url().startsWith(baseUrl)) {
        failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText || 'failed'}`)
      }
    })

    for (const route of routeSet.routes) {
      runtimeErrors.length = 0
      failedRequests.length = 0

      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      })
      const responseStatus = response?.status()
      assert(responseStatus >= 200 && responseStatus < 400, `${route} returned HTTP ${responseStatus || 'unknown'}.`)
      await page.waitForFunction(() => document.querySelector('#root')?.innerText.trim().length > 100, {
        timeout: 15_000,
      })

      const state = await page.evaluate(() => ({
        title: document.title,
        rootTextLength: document.querySelector('#root')?.innerText.trim().length || 0,
        hasHeader: Boolean(document.querySelector('header')),
        hasFooter: Boolean(document.querySelector('footer')),
        brokenImages: [...document.images]
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        robots: document.querySelector('meta[name="robots"]')?.content || '',
        homepageCards: document.querySelectorAll('.product-card').length,
        errorFallback: Boolean(document.querySelector('[role="alert"]')),
      }))

      assert(state.title.trim().length > 0, `${route} has no document title.`)
      assert(state.hasHeader, `${route} has no site header.`)
      assert(state.hasFooter, `${route} has no site footer.`)
      if (route === '/') {
        assert(state.homepageCards === 32, `Homepage rendered ${state.homepageCards} featured cards; expected 32.`)
        assert(!state.errorFallback, 'Homepage rendered the application error fallback.')
      }
      assert(state.brokenImages.length === 0, `${route} has broken images: ${state.brokenImages.join(', ')}`)
      assert(state.overflow <= 1, `${route} overflows horizontally by ${state.overflow}px.`)
      const shouldNoIndex = route.includes('not-a-real')
        || route === '/my-account/'
        || route === '/track-my-order/'
        || route === '/checkout/'
        || route === '/order-confirmation/'
      assert(
        shouldNoIndex ? state.robots.startsWith('noindex') : state.robots.startsWith('index'),
        `${route} has incorrect robots metadata: ${state.robots || 'missing'}.`,
      )
      assert(runtimeErrors.length === 0, `${route} logged runtime errors: ${runtimeErrors.join(' | ')}`)
      assert(failedRequests.length === 0, `${route} had failed local requests: ${failedRequests.join(' | ')}`)

      results.push({
        viewport: `${routeSet.viewport.width}x${routeSet.viewport.height}`,
        route,
        title: state.title,
        rootTextLength: state.rootTextLength,
      })
    }

    await page.close()
  }

  const accessibilityPage = await browser.newPage()
  await accessibilityPage.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  await accessibilityPage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30_000 })
  await accessibilityPage.evaluate(() => localStorage.setItem('php-research-confirmed', 'true'))

  const searchTrigger = '.header-actions button[aria-label="Search"]'
  await accessibilityPage.click(searchTrigger)
  await accessibilityPage.waitForFunction(() => document.activeElement?.name === 'search')
  assert(await accessibilityPage.$eval('.app-content', (element) => element.hasAttribute('inert')), 'Search did not make the background inert.')
  await accessibilityPage.keyboard.press('Escape')
  await accessibilityPage.waitForFunction((selector) => document.activeElement?.matches(selector), {}, searchTrigger)

  const cartTrigger = '.header-actions button[aria-label="Open cart"]'
  await accessibilityPage.click(cartTrigger)
  await accessibilityPage.waitForFunction(() => document.activeElement?.closest('.cart-drawer'))
  await accessibilityPage.keyboard.press('Escape')
  await accessibilityPage.waitForFunction((selector) => document.activeElement?.matches(selector), {}, cartTrigger)

  await accessibilityPage.goto(`${baseUrl}/dilution-guide/`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await accessibilityPage.click('.dilution-chart-button')
  await accessibilityPage.waitForFunction(() => document.activeElement?.matches('.dilution-lightbox-close'))
  await accessibilityPage.keyboard.press('Escape')
  await accessibilityPage.waitForFunction(() => !document.querySelector('.dilution-lightbox') && document.activeElement?.matches('.dilution-chart-button'))

  await accessibilityPage.evaluate(() => localStorage.removeItem('php-research-confirmed'))
  await accessibilityPage.goto(`${baseUrl}/shop/`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await accessibilityPage.waitForFunction(() => document.activeElement?.matches('.gate-check input'))
  await accessibilityPage.keyboard.press('Escape')
  assert(Boolean(await accessibilityPage.$('.research-gate')), 'The required research gate closed on Escape.')
  await accessibilityPage.click('.gate-check input')
  await accessibilityPage.click('.gate-actions .button-primary')
  await accessibilityPage.waitForFunction(() => !document.querySelector('.research-gate'))
  await accessibilityPage.close()

  console.table(results)
  console.log(`Production smoke test passed for ${results.length} route/viewport combinations at ${baseUrl}.`)
  console.log('Overlay accessibility smoke passed for search, cart, dilution chart, and the required research gate.')
} finally {
  if (browser) await browser.close()
  if (preview.exitCode === null) preview.kill()
  if (previewErrors.trim()) process.stderr.write(previewErrors)
}
