import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { shopProducts } from '../src/catalog.js'

const root = path.resolve(import.meta.dirname, '..')
const previewDir = path.join(root, 'preview')
const baseUrl = process.env.SHOP_QA_URL || 'http://127.0.0.1:4173'
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function clickText(page, selector, text) {
  const clicked = await page.evaluate(({ selector: targetSelector, text: targetText }) => {
    const target = [...document.querySelectorAll(targetSelector)]
      .find((node) => node.textContent.trim() === targetText)
    target?.click()
    return Boolean(target)
  }, { selector, text })
  assert(clicked, `Could not find “${text}” within ${selector}`)
  await delay(80)
}

await fs.mkdir(previewDir, { recursive: true })

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

const report = { assertions: [], consoleErrors: [], failedResponses: [] }

try {
  const page = await browser.newPage()
  page.setDefaultTimeout(12_000)
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400) report.failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/_vercel/')) {
      request.respond({ status: 204, contentType: 'application/javascript', body: '' })
    } else {
      request.continue()
    }
  })
  await page.evaluateOnNewDocument(() => localStorage.setItem('php-research-confirmed', 'true'))

  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}/shop/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.shop-card')
  await delay(250)

  const desktop = await page.evaluate(() => ({
    title: document.title,
    pathname: location.pathname,
    cards: document.querySelectorAll('.shop-card').length,
    sectionHeadings: [...document.querySelectorAll('.shop-section-heading')]
      .map((node) => node.textContent.trim()),
    firstThree: [...document.querySelectorAll('.shop-card img')]
      .slice(0, 3)
      .map((node) => node.alt),
    selectedSort: document.querySelector('#shop-product-sort')?.selectedOptions[0]?.textContent.trim(),
    pageHeight: document.documentElement.scrollHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    columns: getComputedStyle(document.querySelector('.shop-grid')).gridTemplateColumns,
  }))

  const initiallyVisible = ['vials', 'capsules', 'liquids', 'topicals']
    .reduce((sum, type) => sum + Math.min(24, shopProducts.filter((product) => product.type === type).length), 0)
  assert(desktop.cards === initiallyVisible, `Expected ${initiallyVisible} initially paginated product cards, found ${desktop.cards}`)
  assert(desktop.sectionHeadings.join('|') === 'Vials - 74 results|Capsules - 17 results|Liquids - 16 results|Topicals - 8 results', 'Section totals do not match the live catalog')
  assert(desktop.firstThree.every(Boolean), 'Default catalog image alt text is missing')
  assert(desktop.selectedSort === 'Select Filter', 'Default sort placeholder is incorrect')
  assert(desktop.overflow === 0, 'Desktop page has horizontal overflow')
  report.assertions.push('desktop catalog, order, totals, routing, and overflow')
  report.desktop = desktop
  await page.screenshot({ path: path.join(previewDir, 'shop-desktop.png'), fullPage: false })

  while (await page.$('.shop-section .shop-search-clear')) {
    await page.$$eval('.shop-section .shop-search-clear', (buttons) => buttons.forEach((button) => button.click()))
    await delay(80)
  }
  assert(await page.$$eval('.shop-card', (nodes) => nodes.length) === shopProducts.length, 'Load-more pagination did not reveal the complete catalog')
  report.assertions.push('24-item pagination and incremental catalog expansion')

  await clickText(page, '.shop-research-filter button', 'Metabolic')
  const metabolicActual = await page.$$eval('.shop-section-heading', (nodes) =>
    nodes.map((node) => Number(node.textContent.match(/-\s+(\d+)\s+result/)?.[1] || 0)),
  )
  const typeOrder = ['vials', 'capsules', 'liquids', 'topicals']
  const metabolicExpected = typeOrder.map((type) =>
    shopProducts.filter((product) => product.type === type && product.categories.includes('metabolic')).length,
  )
  assert(JSON.stringify(metabolicActual) === JSON.stringify(metabolicExpected), 'Metabolic filter counts are incorrect')
  await clickText(page, '.shop-research-filter button', 'ALL')
  report.assertions.push('research-category filtering and dynamic counts')

  await page.select('#shop-product-sort', 'title-desc')
  await delay(80)
  const firstDescending = await page.$eval('.shop-card h3', (node) => node.textContent.trim())
  const expectedDescending = [...shopProducts]
    .filter((product) => product.type === 'vials')
    .sort((left, right) => right.name.localeCompare(left.name, 'en', { numeric: true, sensitivity: 'base' }))[0].name
  assert(firstDescending === expectedDescending, 'Title Z-A sorting is incorrect')

  await page.select('#shop-product-sort', 'latest')
  await delay(80)
  const firstLatest = await page.$eval('.shop-card h3', (node) => node.textContent.trim())
  const expectedLatest = [...shopProducts]
    .filter((product) => product.type === 'vials')
    .sort((left, right) => right.latestOrder - left.latestOrder || right.order - left.order)[0].name
  assert(firstLatest === expectedLatest, 'Latest sorting is incorrect')
  await page.select('#shop-product-sort', 'default')
  report.assertions.push('title and live-date sorting')

  while (await page.$('.shop-section .shop-search-clear')) {
    await page.$$eval('.shop-section .shop-search-clear', (buttons) => buttons.forEach((button) => button.click()))
    await delay(80)
  }

  await page.select('#shop-product-vials-419-option', '2')
  await delay(60)
  const variantState = await page.evaluate(() => {
    const glp2 = document.querySelector('#shop-product-vials-474-option')
    const cortagenButton = document.querySelector('#shop-product-vials-25761 .shop-add-button')
    return {
      bpcPrice: document.querySelector('#shop-product-vials-419 .shop-price')?.textContent.trim(),
      bpcImageAlt: document.querySelector('#shop-product-vials-419 .shop-card-image img')?.alt,
      bpcFacts: [...document.querySelectorAll('#shop-product-vials-419 .shop-variant-facts dd')].map((node) => node.textContent.trim()),
      glp2Default: glp2?.value,
      glp2Disabled: [...glp2.options].map((option) => option.disabled),
      cortagenDisabled: cortagenButton?.disabled,
    }
  })
  assert(variantState.bpcPrice === '$57.00', 'BPC-157 15mg variant price is incorrect')
  const expectedBpcVariant = shopProducts.find((product) => product.id === 'vials-419').options[2]
  assert(variantState.bpcImageAlt === expectedBpcVariant.imageAlt, 'BPC-157 variant image alt did not update')
  assert(variantState.bpcFacts[0] === expectedBpcVariant.sku && variantState.bpcFacts[1] === 'In stock', 'BPC-157 SKU or stock display did not update')
  assert(variantState.bpcFacts[2].includes('U.S.') && variantState.bpcFacts[3].includes('pending approval'), 'BPC-157 shipping restrictions or package data are missing')
  assert(variantState.glp2Default === '2' && variantState.glp2Disabled.join('|') === 'true|true|false|false', 'GLP-2 default or unavailable variants are incorrect')
  assert(variantState.cortagenDisabled, 'Cortagen should be Coming Soon')

  await page.evaluate(() => {
    const card = document.querySelector('#shop-product-capsules-30567')
    const plus = card.querySelectorAll('.shop-qty-btn')[1]
    plus.click()
    plus.click()
  })
  await delay(60)
  const ruleTwoSummary = await page.$eval('#shop-product-capsules-30567 .shop-discount-summary', (node) =>
    node.textContent.replace(/\s+/g, ' ').trim(),
  )
  assert(ruleTwoSummary.includes('7.5% discount') && ruleTwoSummary.includes('Total $357.99'), 'Rule-2 discount total is incorrect')
  report.assertions.push('variant prices/defaults/availability and rule-2 discount')

  await page.evaluate(() => {
    const card = document.querySelector('#shop-product-vials-25738')
    const plus = card.querySelectorAll('.shop-qty-btn')[1]
    plus.click()
    plus.click()
  })
  await delay(80)
  const quantity = await page.$eval('#shop-product-vials-25738 .shop-qty-value', (node) => node.textContent.trim())
  assert(quantity === '3', 'Quantity control did not increment to 3')
  await page.click('#shop-product-vials-25738 .shop-add-button')
  await page.waitForSelector('.drawer-layer.is-open .cart-drawer')
  const cart = await page.evaluate(() => ({
    badge: document.querySelector('.cart-action span')?.textContent.trim(),
    lineQuantity: document.querySelector('.cart-line-actions span')?.textContent.trim(),
    subtotal: document.querySelector('.cart-summary strong')?.textContent.trim(),
  }))
  assert(cart.badge === '3' && cart.lineQuantity === '3' && cart.subtotal === '$258.99', 'Cart quantity or rule-1 discount total is incorrect')
  await page.$eval('.cart-drawer .drawer-heading button', (button) => button.click())
  report.assertions.push('quantity controls, rule-1 discount, and cart drawer')
  report.cart = cart

  await page.click('#shop-product-vials-25738 .shop-learn-button')
  await page.waitForFunction(() => location.pathname === '/product/5-amino-1mq/')
  await page.waitForSelector('.product-detail-page h1')
  const productRouteState = await page.evaluate(() => ({
    pathname: location.pathname,
    title: document.querySelector('.product-detail-page h1')?.textContent.trim(),
    hasLegacyPreview: Boolean(document.querySelector('.product-preview')),
  }))
  assert(productRouteState.pathname === '/product/5-amino-1mq/', 'Learn More used the wrong product route')
  assert(productRouteState.title === '5-Amino-1MQ', 'Learn More opened the wrong product detail')
  assert(!productRouteState.hasLegacyPreview, 'Learn More should not open the legacy preview modal')

  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.shop-card')
  assert(new URL(page.url()).pathname === '/shop/', 'Browser Back did not return from the product detail to Shop')
  report.assertions.push('routed product detail and browser Back navigation')

  await page.click('button[aria-label="Search"]')
  await page.type('input[name="search"]', 'VOCUS')
  await page.$eval('.search-panel form', (form) => form.requestSubmit())
  await page.waitForSelector('.shop-search-notice')
  const searchState = await page.evaluate(() => ({
    notice: document.querySelector('.shop-search-notice')?.textContent.replace(/\s+/g, ' ').trim(),
    cards: document.querySelectorAll('.shop-card').length,
  }))
  assert(searchState.cards === 1 && searchState.notice.includes('1 result'), 'Header search did not narrow the shop to VOCUS')
  await page.$eval('.shop-search-clear', (button) => button.click())
  await delay(80)
  assert(await page.$$eval('.shop-card', (nodes) => nodes.length) === initiallyVisible, 'Clear search did not restore the paginated catalog')
  report.assertions.push('header search and clear-search flow')

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.shop-card')
  await delay(180)
  await page.setViewport({ width: 1920, height: 1100, deviceScaleFactor: 1 })
  await delay(150)
  await page.evaluate(() => window.scrollTo(0, 0))
  const widescreen = await page.evaluate(() => ({
    sidebar: getComputedStyle(document.querySelector('.shop-sidebar')).display,
    sidebarWidth: Math.round(document.querySelector('.shop-sidebar').getBoundingClientRect().width),
    layoutWidth: Math.round(document.querySelector('.shop-catalog-layout').getBoundingClientRect().width),
    columns: getComputedStyle(document.querySelector('.shop-grid')).gridTemplateColumns,
    firstSidebarGroup: document.querySelector('.shop-sidebar-group-title')?.textContent.trim(),
    headerWidth: Math.round(document.querySelector('.header-inner').getBoundingClientRect().width),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))
  assert(widescreen.sidebar === 'block' && widescreen.sidebarWidth === 303, 'Widescreen product sidebar geometry is incorrect')
  assert(widescreen.layoutWidth === 1424 && widescreen.firstSidebarGroup === 'Topicals', 'Widescreen catalog layout or sidebar order is incorrect')
  assert(widescreen.overflow === 0, 'Widescreen page has horizontal overflow')
  report.assertions.push('widescreen sidebar and four-column geometry')
  report.widescreen = widescreen
  await page.screenshot({ path: path.join(previewDir, 'shop-widescreen.png'), fullPage: false })

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await delay(180)
  await page.evaluate(() => window.scrollTo(0, 0))
  const mobile = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.shop-chip')]
    const rect = (text, group = null) => {
      const pool = group ? [...document.querySelector(group).querySelectorAll('.shop-chip')] : chips
      const node = pool.find((item) => item.textContent.trim() === text)
      const box = node.getBoundingClientRect()
      return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) }
    }
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cardWidth: Math.round(document.querySelector('.shop-card').getBoundingClientRect().width),
      gridColumns: getComputedStyle(document.querySelector('.shop-grid')).gridTemplateColumns,
      topicals: rect('Topicals', '.shop-type-filter'),
      allType: rect('ALL', '.shop-type-filter'),
      vials: rect('Vials', '.shop-type-filter'),
      capsules: rect('Capsules', '.shop-type-filter'),
      liquids: rect('Liquids', '.shop-type-filter'),
      immune: rect('Immune & Inflammatory', '.shop-research-filter'),
      metabolic: rect('Metabolic', '.shop-research-filter'),
      pageHeight: document.documentElement.scrollHeight,
    }
  })
  assert(mobile.overflow === 0 && mobile.cardWidth === 300, 'Mobile card width or overflow is incorrect')
  assert(mobile.topicals.y === mobile.allType.y && mobile.allType.y === mobile.vials.y, 'Mobile type-filter first row is incorrect')
  assert(mobile.capsules.y === mobile.liquids.y && mobile.capsules.y > mobile.vials.y, 'Mobile type-filter second row is incorrect')
  assert(mobile.immune.y === mobile.metabolic.y, 'Mobile Immune and Metabolic chips do not share a row')
  report.assertions.push('mobile title/filter wrapping, one-column cards, and overflow')
  report.mobile = mobile
  await page.screenshot({ path: path.join(previewDir, 'shop-mobile.png'), fullPage: false })

  assert(report.consoleErrors.length === 0, `Browser console errors: ${report.consoleErrors.join(' | ')}; responses: ${report.failedResponses.join(' | ')}`)
  report.assertions.push('zero browser console errors')
  report.status = 'passed'
} finally {
  await browser.close()
}

console.log(JSON.stringify(report, null, 2))
