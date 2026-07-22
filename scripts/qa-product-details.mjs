import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { shopProducts } from '../src/catalog.js'
import {
  isProductPath,
  productBySlug,
  productFromPath,
  productPath,
  productSlug,
} from '../src/productRoutes.js'

const root = path.resolve(import.meta.dirname, '..')
const previewDir = path.join(root, 'preview', 'product-details-qa')
const baseUrl = process.env.PRODUCT_QA_URL || process.env.SHOP_QA_URL || 'http://127.0.0.1:4173'
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const representatives = [
  {
    type: 'vials',
    path: '/product/bpc-157/',
    heading: 'BPC-157',
    optionPrompt: 'Select Weight',
  },
  {
    type: 'capsules',
    path: '/product/bpc-157-arginate-salt/',
    heading: 'BPC-157 (Arginate Salt)',
    optionPrompt: 'Select Volume',
  },
  {
    type: 'liquids',
    path: '/product/bpc-157-liquid/',
    heading: 'BPC-157',
    optionPrompt: 'Select Volume',
  },
  {
    type: 'topicals',
    path: '/product/modular-peptide-system-a-dual-peptide-serum/',
    heading: 'Modular Peptide System A – Dual Peptide Serum',
    optionPrompt: 'Select Weight',
  },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitForProductImages(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.product-detail-page img[loading="lazy"]')
      .forEach((image) => { image.loading = 'eager' })
  })
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('.product-detail-page img')]
    return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0)
  }, { timeout: 30_000 })
}

async function inspectProduct(page, representative, viewportName) {
  await page.waitForSelector('.product-detail-page h1')
  await waitForProductImages(page)
  await delay(120)

  const state = await page.evaluate(() => {
    const pageRoot = document.querySelector('.product-detail-page')
    const desktopGallery = document.querySelector('.product-gallery-desktop')
    const mobileGallery = document.querySelector('.product-gallery-mobile')
    const images = [...pageRoot.querySelectorAll('img')]
    return {
      pathname: location.pathname,
      title: document.title,
      heading: pageRoot.querySelector('h1')?.textContent.trim(),
      pageClass: pageRoot.className,
      optionPrompt: pageRoot.querySelector('.product-buy-controls label > span')?.textContent.trim(),
      galleryImages: pageRoot.querySelectorAll('.product-gallery img').length,
      descriptionLength: pageRoot.querySelector('.product-description-html')?.textContent.trim().length || 0,
      coaHeading: pageRoot.querySelector('.product-coa-callout h2')?.textContent.trim(),
      brokenImages: images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pageHeight: document.documentElement.scrollHeight,
      desktopGalleryDisplay: desktopGallery ? getComputedStyle(desktopGallery).display : null,
      mobileGalleryDisplay: mobileGallery ? getComputedStyle(mobileGallery).display : null,
      hasRelatedHeading: Boolean(pageRoot.querySelector('.product-related-heading')),
      relatedProducts: pageRoot.querySelectorAll('.product-related-grid > a').length,
      breadcrumbLinks: pageRoot.querySelectorAll('.product-breadcrumb a').length,
      hasNewsletter: Boolean(document.querySelector('.newsletter-section')),
    }
  })

  assert(state.pathname === representative.path, `${viewportName} ${representative.type}: canonical pathname is incorrect`)
  assert(state.heading === representative.heading, `${viewportName} ${representative.type}: product heading is incorrect`)
  assert(state.pageClass.includes(`product-detail-${representative.type}`), `${viewportName} ${representative.type}: type class is missing`)
  assert(state.optionPrompt === representative.optionPrompt, `${viewportName} ${representative.type}: option prompt is incorrect`)
  assert(state.galleryImages >= 2, `${viewportName} ${representative.type}: gallery is incomplete`)
  assert(state.descriptionLength > 150, `${viewportName} ${representative.type}: detailed description is missing`)
  assert(state.coaHeading === 'Certificate of Analysis', `${viewportName} ${representative.type}: COA callout is missing`)
  assert(state.relatedProducts === 4, `${viewportName} ${representative.type}: related product links are incomplete`)
  assert(state.breadcrumbLinks === 2, `${viewportName} ${representative.type}: visible breadcrumb links are incomplete`)
  assert(state.brokenImages.length === 0, `${viewportName} ${representative.type}: broken images: ${state.brokenImages.join(', ')}`)
  assert(state.overflow === 0, `${viewportName} ${representative.type}: horizontal overflow is ${state.overflow}px`)
  assert(state.title && !state.title.includes('Product Not Found'), `${viewportName} ${representative.type}: document title is incorrect`)

  if (viewportName === 'desktop') {
    assert(state.desktopGalleryDisplay !== 'none' && state.mobileGalleryDisplay === 'none', `${representative.type}: desktop gallery state is incorrect`)
  } else {
    assert(state.desktopGalleryDisplay === 'none' && state.mobileGalleryDisplay !== 'none', `${representative.type}: mobile gallery state is incorrect`)
  }

  if (representative.type === 'topicals') {
    assert(!state.hasRelatedHeading && state.hasNewsletter, `${viewportName} topical: empty related-products heading or newsletter state is incorrect`)
  } else if (representative.type === 'liquids') {
    assert(!state.hasRelatedHeading && !state.hasNewsletter, `${viewportName} liquid: empty related-products heading or newsletter state is incorrect`)
  } else {
    assert(!state.hasRelatedHeading, `${viewportName} ${representative.type}: unexpected related-products section`)
  }

  return state
}

function verifyRouteUtilities(report) {
  assert(shopProducts.length === 115, `Expected 115 catalog products, found ${shopProducts.length}`)
  assert(productBySlug.size === 115, `Expected 115 indexed product slugs, found ${productBySlug.size}`)

  const paths = new Set()
  for (const product of shopProducts) {
    const slug = productSlug(product)
    const pathname = productPath(product)
    paths.add(pathname)
    assert(slug, `Missing product slug for ${product.name}`)
    assert(isProductPath(pathname), `Generated path is not recognized for ${product.name}`)
    assert(productFromPath(pathname) === product, `Path round trip failed for ${product.name}`)
    assert(productFromPath(pathname.slice(0, -1)) === product, `Slashless path round trip failed for ${product.name}`)
    assert(productFromPath(product.productUrl) === product, `Absolute URL round trip failed for ${product.name}`)
  }

  assert(paths.size === 115, `Expected 115 unique product paths, found ${paths.size}`)
  const encoded = '/product/bpc-157-tb-500-t-beta-4-blend/'
  assert(productFromPath(encoded)?.name === 'BPC-157 / TB-500 (Tβ4) Blend', 'Percent-encoded, mixed-case slug lookup failed')
  report.assertions.push('115 unique canonical product-route round trips, including encoded slugs')
}

await fs.mkdir(previewDir, { recursive: true })

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

const report = {
  assertions: [],
  representatives: {},
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
}

try {
  verifyRouteUtilities(report)

  const page = await browser.newPage()
  page.setDefaultTimeout(15_000)
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => report.pageErrors.push(error.message))
  await page.evaluateOnNewDocument(() => localStorage.setItem('php-research-confirmed', 'true'))

  for (const [viewportName, viewport] of Object.entries({
    desktop: { width: 1440, height: 1000, deviceScaleFactor: 1 },
    mobile: { width: 390, height: 844, deviceScaleFactor: 1 },
  })) {
    await page.setViewport(viewport)
    for (const representative of representatives) {
      await page.goto(`${baseUrl}${representative.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      const state = await inspectProduct(page, representative, viewportName)
      report.representatives[`${viewportName}:${representative.type}`] = state

      const filename = `${representative.type}-${viewportName}.png`
      await page.screenshot({ path: path.join(previewDir, filename), fullPage: true })
      report.screenshots.push(path.join('preview', 'product-details-qa', filename).replaceAll('\\', '/'))
    }
  }
  report.assertions.push('representative vial, capsule, liquid, and topical detail pages at desktop and mobile widths')
  report.assertions.push('responsive gallery switching, detailed content, COA callouts, images, and zero horizontal overflow')

  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}/product/bpc-157/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.product-detail-page h1')
  const titleBeforeReload = await page.title()
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.product-detail-page h1')
  assert(new URL(page.url()).pathname === '/product/bpc-157/', 'Direct reload did not preserve the product pathname')
  assert(await page.$eval('.product-detail-page h1', (node) => node.textContent.trim()) === 'BPC-157', 'Direct reload did not restore the product')
  assert(await page.title() === titleBeforeReload, 'Direct reload changed the product document title')
  report.assertions.push('direct product-route reload')

  await page.goto(`${baseUrl}/shop/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('#shop-product-vials-25738 .shop-learn-button')
  await page.click('#shop-product-vials-25738 .shop-learn-button')
  await page.waitForFunction(() => location.pathname === '/product/5-amino-1mq/')
  await page.waitForSelector('.product-detail-page h1')
  assert(await page.$eval('.product-detail-page h1', (node) => node.textContent.trim()) === '5-Amino-1MQ', 'Shop Learn More opened the wrong product')
  assert(await page.$('.product-preview') === null, 'Shop Learn More opened the removed preview modal')

  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.shop-card')
  assert(new URL(page.url()).pathname === '/shop/', 'Browser Back did not return to Shop')
  await page.goForward({ waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.product-detail-page h1')
  assert(new URL(page.url()).pathname === '/product/5-amino-1mq/', 'Browser Forward did not restore the product route')
  assert(await page.$eval('.product-detail-page h1', (node) => node.textContent.trim()) === '5-Amino-1MQ', 'Browser Forward restored the wrong product')
  report.assertions.push('Shop Learn More plus browser Back/Forward navigation')

  await page.goto(`${baseUrl}/product/bpc-157/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.product-buy-controls select')
  assert(await page.$eval('.product-detail-price-row strong', (node) => node.textContent.trim()) === '$22.00', 'Initial BPC-157 price is incorrect')
  await page.select('.product-buy-controls select', '1')
  await page.waitForFunction(() => document.querySelector('.product-detail-price-row strong')?.textContent.trim() === '$40.00')
  const selectedFacts = await page.$$eval('.product-variant-facts dd', (nodes) => nodes.map((node) => node.textContent.trim()))
  const expectedVariant = shopProducts.find((product) => product.id === 'vials-419').options[1]
  assert(selectedFacts[0] === expectedVariant.sku && selectedFacts[1] === 'In stock', 'Variant SKU or stock did not update on the product detail')
  assert(selectedFacts[2].includes('pending approval') && selectedFacts[3].includes('U.S.'), 'Variant package or shipping restriction did not update on the product detail')
  await page.click('button[aria-label="Increase quantity"]')
  assert(await page.$eval('.product-detail-amount input', (node) => node.value) === '2', 'Product quantity did not increment to 2')
  await page.click('.product-detail-add')
  await page.waitForSelector('.drawer-layer.is-open .cart-drawer')
  const cartState = await page.evaluate(() => ({
    badge: document.querySelector('.cart-action span')?.textContent.trim(),
    product: document.querySelector('.cart-line h3')?.textContent.trim(),
    option: document.querySelector('.cart-line p')?.textContent.trim(),
    quantity: document.querySelector('.cart-line-actions span')?.textContent.trim(),
    subtotal: document.querySelector('.cart-summary strong')?.textContent.trim(),
  }))
  assert(cartState.badge === '2', 'Product-detail cart badge is incorrect')
  assert(cartState.product === 'BPC-157' && cartState.option === '10mg', 'Product-detail cart line is incorrect')
  assert(cartState.quantity === '2' && cartState.subtotal === '$78.40', 'Product-detail cart quantity or discount subtotal is incorrect')
  await page.$eval('.cart-drawer .drawer-heading button', (button) => button.click())
  report.cart = cartState
  report.assertions.push('detail option pricing, quantity controls, discount pricing, and cart drawer')

  await page.click('.product-coa-callout a')
  await page.waitForFunction(() => location.pathname === '/coa-library/vials/')
  await page.waitForSelector('.coa-category-vials h1')
  assert(await page.$eval('.coa-category-vials h1', (node) => node.textContent.trim()) === 'Vial Certificate of Analysis (COA) library', 'Vial COA destination heading is incorrect')
  report.assertions.push('product-type COA navigation')

  await page.goto(`${baseUrl}/product/does-not-exist/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.product-not-found h1')
  const invalidState = await page.evaluate(() => ({
    pathname: location.pathname,
    title: document.title,
    heading: document.querySelector('.product-not-found h1')?.textContent.trim(),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))
  assert(invalidState.pathname === '/product/does-not-exist/', 'Invalid product route pathname changed unexpectedly')
  assert(invalidState.title === 'Product Not Found | Pure Health Peptides', 'Invalid product document title is incorrect')
  assert(invalidState.heading === 'This research product is unavailable.', 'Invalid product fallback is incorrect')
  assert(invalidState.overflow === 0, 'Invalid product fallback has horizontal overflow')
  report.invalidProduct = invalidState
  report.assertions.push('invalid-product fallback route')

  const uniqueConsoleErrors = [...new Set(report.consoleErrors)]
  const uniquePageErrors = [...new Set(report.pageErrors)]
  report.consoleErrors = uniqueConsoleErrors
  report.pageErrors = uniquePageErrors
  assert(uniqueConsoleErrors.length === 0, `Browser console errors: ${uniqueConsoleErrors.join(' | ')}`)
  assert(uniquePageErrors.length === 0, `Uncaught page errors: ${uniquePageErrors.join(' | ')}`)
  report.assertions.push('zero browser console and uncaught page errors')
  report.status = 'passed'
} finally {
  await browser.close()
}

console.log(JSON.stringify(report, null, 2))
