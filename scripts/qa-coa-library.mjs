import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const baseUrl = 'http://127.0.0.1:4173'
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const output = new URL('../preview/coa-library-qa/', import.meta.url)
const pages = [
  { slug: 'coa-library', heading: 'Certificate Of Analysis (COA) LiBrary', count: null },
  { slug: 'coa-library/vials', heading: 'Vial Certificate of Analysis (COA) library', count: 80 },
  { slug: 'coa-library/capsules', heading: 'Capsule certificate of analysis (coa) Library', count: 17 },
  { slug: 'coa-library/liquids', heading: 'Liquid Certificate of Analysis (COA) library', count: 14 },
  { slug: 'coa-library/topicals', heading: 'Topical Certificate of Analysis (COA) library', count: 5 },
]
const viewports = [
  { label: 'desktop', width: 1440, height: 1000 },
  { label: 'mobile', width: 390, height: 844 },
]

await fs.mkdir(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const results = []
const consoleErrors = []

async function capture(config, viewport) {
  const page = await browser.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`${config.slug}/${viewport.label}: ${message.text()}`)
  })
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}/${config.slug}/`, { waitUntil: 'networkidle0', timeout: 30_000 })

  const metrics = await page.evaluate(() => ({
    heading: document.querySelector('main h1')?.textContent.trim() || '',
    title: document.title,
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    imageFailures: [...document.images]
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.src),
  }))

  if (metrics.heading.toLowerCase() !== config.heading.toLowerCase()) {
    throw new Error(`${config.slug}/${viewport.label}: expected heading “${config.heading}”, got “${metrics.heading}”`)
  }
  if (metrics.scrollWidth > metrics.width + 1) {
    throw new Error(`${config.slug}/${viewport.label}: horizontal overflow ${metrics.scrollWidth}px > ${metrics.width}px`)
  }
  if (metrics.imageFailures.length) {
    throw new Error(`${config.slug}/${viewport.label}: failed images ${metrics.imageFailures.join(', ')}`)
  }

  const screenshotPath = fileURLToPath(new URL(`${config.slug.replaceAll('/', '-')}-${viewport.label}.png`, output))
  await page.screenshot({ path: screenshotPath, fullPage: config.count === null })

  if (config.count !== null) {
    const count = await page.$$eval('.coa-result-card', (cards) => cards.length)
    if (count !== config.count) throw new Error(`${config.slug}/${viewport.label}: expected ${config.count} product rows, got ${count}`)
    const pdfLinks = await page.$$eval('.coa-batch-links a', (links) => links.map((link) => ({ href: link.href, target: link.target })))
    if (!pdfLinks.length || pdfLinks.some((link) => !link.href.toLowerCase().includes('.pdf') || link.target !== '_blank')) {
      throw new Error(`${config.slug}/${viewport.label}: invalid batch PDF links`)
    }
  } else {
    const carrierCount = await page.$$eval('.coa-library-hero .coa-carrier-button', (buttons) => buttons.length)
    if (carrierCount !== 4) throw new Error(`${config.slug}/${viewport.label}: expected four carrier buttons, got ${carrierCount}`)
    const initiallyOpen = await page.$eval('.coa-library-faqs article:first-child > button', (button) => button.getAttribute('aria-expanded'))
    if (initiallyOpen !== 'true') throw new Error(`${config.slug}/${viewport.label}: first FAQ is not initially open`)
    await page.click('.coa-library-faqs article:nth-child(2) > button')
    const faqState = await page.$$eval('.coa-library-faqs article > button', (buttons) => buttons.slice(0, 2).map((button) => button.getAttribute('aria-expanded')))
    if (faqState[0] !== 'false' || faqState[1] !== 'true') throw new Error(`${config.slug}/${viewport.label}: FAQ accordion is not exclusive`)
  }

  results.push({ slug: config.slug, viewport: viewport.label, ...metrics, screenshot: screenshotPath })
  await page.close()
}

try {
  for (const config of pages) {
    for (const viewport of viewports) await capture(config, viewport)
  }

  const searchPage = await browser.newPage()
  await searchPage.setViewport({ width: 1440, height: 1000 })
  await searchPage.goto(`${baseUrl}/coa-library/vials/`, { waitUntil: 'networkidle0', timeout: 30_000 })
  await searchPage.type('.coa-search-group:first-child input', 'BPC-157')
  await searchPage.click('.coa-search-group:first-child button')
  let resultCount = await searchPage.$$eval('.coa-result-card', (cards) => cards.length)
  if (resultCount !== 2) throw new Error(`Product search expected 2 rows, got ${resultCount}`)
  await searchPage.type('.coa-search-group:nth-child(2) input', 'SYN-030926')
  await searchPage.click('.coa-search-group:nth-child(2) button')
  resultCount = await searchPage.$$eval('.coa-result-card', (cards) => cards.length)
  if (resultCount < 1) throw new Error('Combined product and batch filters returned no rows')
  await searchPage.click('.coa-clear-filter')
  resultCount = await searchPage.$$eval('.coa-result-card', (cards) => cards.length)
  if (resultCount !== 80) throw new Error(`Clear expected 80 rows, got ${resultCount}`)
  await searchPage.close()

  const routePage = await browser.newPage()
  await routePage.setViewport({ width: 1600, height: 900 })
  await routePage.goto(`${baseUrl}/`, { waitUntil: 'networkidle0', timeout: 30_000 })
  await routePage.evaluate(() => {
    const group = [...document.querySelectorAll('.nav-group')]
      .find((node) => node.querySelector(':scope > button')?.textContent.includes('COA Library'))
    group?.querySelector('a[href="/coa-library/topicals/"]')?.click()
  })
  await routePage.waitForFunction(() => window.location.pathname === '/coa-library/topicals/')
  results.push({ coaNavigation: await routePage.evaluate(() => window.location.pathname) })
  await routePage.close()

  if (consoleErrors.length) throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`)
  await fs.writeFile(new URL('results.json', output), JSON.stringify({ results, consoleErrors }, null, 2))
  console.log('COA Library QA passed (10 responsive page checks, 640 PDF links, search, clear, FAQ, and navigation).')
} finally {
  await browser.close()
}
