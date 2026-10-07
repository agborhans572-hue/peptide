import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'
import { serveBuiltSite } from './serve-built-site.mjs'
import { productionRoutes } from './site-routes.mjs'
const { server, url } = await serveBuiltSite()
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const results = []
const paths = ['/', '/shipping-policy/', '/product/n-acetyl-semax-amidate/', '/coa-library/', '/coa-library/vials/', '/shop/', '/product/bpc-157/', '/product/bpc-157-tb-500/', '/product/bpc-157-arginate-salt/', '/product/bpc-157-liquid/', '/product/modular-peptide-system-a-dual-peptide-serum/', ...productionRoutes.filter((r) => !r.indexable).map((r) => r.path), '/cart/', '/product/missing/', '/missing/']
try {
  await mkdir('artifacts/seo-validation', { recursive: true })
  for (const javaScriptEnabled of [false, true]) {
    const page = await browser.newPage()
    await page.setJavaScriptEnabled(javaScriptEnabled)
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    for (const path of paths) {
      const response = await page.goto(url + path, { waitUntil: 'networkidle0' })
      const expected = productionRoutes.find((r) => r.path === path)
      if (javaScriptEnabled && expected?.indexable) await page.waitForSelector('h1')
      const state = await page.evaluate(() => ({
        title: document.title, description: document.querySelector('meta[name="description"]')?.content,
        headings: [...document.querySelectorAll('h1')].map((n) => n.textContent.trim()), canonical: document.querySelector('link[rel="canonical"]')?.href,
        robots: document.querySelector('meta[name="robots"]')?.content,
        content: document.querySelector('main')?.textContent.trim().length || 0,
        schema: JSON.parse(document.querySelector('#seo-jsonld')?.textContent || 'null'),
        links: document.querySelectorAll('a[href]').length,
        overflow: document.documentElement.scrollWidth - innerWidth,
      }))
      assert.equal(response.status(), expected ? 200 : 404, path)
      assert.equal(state.headings.length, 1, path + ' H1')
      assert.ok(state.description && state.links > 0 && state.content > 40, path + ' metadata/content/links')
      if (expected) {
        assert.equal(state.title, expected.title.replace(/\s+/g, ' '), path + ' title')
        assert.equal(state.canonical, 'https://purehealthpeptidesshop.com' + path, path + ' canonical')
        assert.equal(state.robots.startsWith('index, follow'), expected.indexable, path + ' robots')
        if (expected.kind === 'product') assert.equal(state.schema?.['@graph'].find((n) => n['@type'] === 'Product')?.name, expected.product.name, path + ' schema')
      } else assert.ok(state.robots.includes('noindex') && !state.canonical && !state.schema, path + ' genuine 404')
      assert.ok(state.overflow <= 1, path + ' mobile overflow: ' + state.overflow)
      results.push({ path, javaScriptEnabled, status: response.status(), ...state, schema: Boolean(state.schema) })
      if (['/', '/product/bpc-157/', '/shipping-policy/'].includes(path)) await page.screenshot({ path: `artifacts/seo-validation/${javaScriptEnabled ? 'js' : 'no-js'}-${path.replaceAll('/', '_')}.png`, fullPage: false })
    }
    await page.close()
  }
  // Runtime navigation: no stale schema during a pending/failed product request; drawer leaves robots alone.
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('php-research-confirmed', 'true')
    let seen = false
    window.__productSchemaRemovals = 0
    new MutationObserver(() => {
      if (location.pathname !== '/product/bpc-157/') return
      const present = document.querySelector('#seo-jsonld')?.textContent.includes('"@type":"Product"')
      if (present) seen = true
      else if (seen) window.__productSchemaRemovals++
    }).observe(document, { childList: true, subtree: true, characterData: true })
  })
  await page.goto(url + '/product/bpc-157/', { waitUntil: 'networkidle0' })
  assert.equal(await page.evaluate(() => window.__productSchemaRemovals), 0, 'matching initial product schema was preserved')
  const before = await page.$eval('meta[name="robots"]', (n) => n.content)
  await page.click('button[aria-label="Open cart"]')
  assert.equal(await page.$eval('meta[name="robots"]', (n) => n.content), before)
  await page.click('button[aria-label="Close cart"]')
  const target = await page.$eval('.product-related-grid > a', (a) => ({ path: a.getAttribute('href'), name: a.querySelector('h3')?.textContent.trim() }))
  let pending
  await page.setRequestInterception(true)
  page.on('request', (request) => { if (request.url().includes('/products/') && request.url().endsWith('.json')) pending = request; else request.continue() })
  await page.click('.product-related-grid > a')
  await page.waitForFunction((path) => location.pathname === path && document.querySelector('link[rel="canonical"]')?.href.endsWith(path), {}, target.path)
  const schemaWhileLoading = await page.$eval('head', (head) => head.querySelector('#seo-jsonld')?.textContent || '')
  assert.ok(!schemaWhileLoading.includes('"name":"BPC-157"'), 'old product schema must not remain during navigation')
  for (let i = 0; !pending && i < 50; i++) await new Promise((done) => setTimeout(done, 100))
  assert.ok(pending, 'immutable product document requested')
  await pending.respond({ status: 503, contentType: 'application/json', body: '{}' })
  await page.waitForSelector('[role="alert"] h1')
  assert.ok(!(await page.title()).includes('Not Found'), 'request failure is not a soft 404')
  assert.equal(await page.$eval('meta[name="robots"]', (n) => n.content), before)
  page.removeAllListeners('request')
  await page.setRequestInterception(false)
  await page.reload({ waitUntil: 'networkidle0' })
  const targetRoute = productionRoutes.find((r) => r.path === target.path)
  assert.equal(await page.$eval('#seo-jsonld', (n) => JSON.parse(n.textContent)['@graph'].find((x) => x['@type'] === 'Product').name), targetRoute.product.name)
  await page.evaluate(() => { history.pushState({}, '', '/unknown-client-route/'); dispatchEvent(new PopStateEvent('popstate')) })
  await page.waitForFunction(() => document.title === 'Page Not Found | Pure Health Peptides')
  assert.ok(await page.$eval('h1', (n) => /not found/i.test(n.textContent)), 'client navigation renders not found')
  assert.equal(await page.$('link[rel="canonical"]'), null)
  assert.equal(await page.$('#seo-jsonld'), null)
  await page.close()
  await writeFile('artifacts/seo-validation/browser.json', JSON.stringify({ results, navigation: 'loading, failure, reload, and cart robots passed' }, null, 2))
  console.log(`Browser SEO QA passed: ${results.length} representative page checks with JavaScript enabled/disabled, mobile layout, product navigation/failure and cart metadata.`)
} finally { await browser.close(); await new Promise((done) => server.close(done)) }
