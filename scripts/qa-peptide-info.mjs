import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const baseUrl = 'http://127.0.0.1:4173'
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const output = new URL('../preview/peptide-info-qa/', import.meta.url)
const pages = [
  ['info-cards', 'Product Info Cards'],
  ['coa-process', 'Why testing matters'],
  ['manufacturing', "Where they cOme frOm.HOw they're maDe."],
  ['dilution-guide', 'Dilution Recommendation Guide'],
]

await fs.mkdir(output, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const results = []
const consoleErrors = []

async function capture(slug, expectedHeading, viewport) {
  const page = await browser.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`${slug}/${viewport.label}: ${message.text()}`)
  })
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}/${slug}/`, { waitUntil: 'networkidle0', timeout: 30_000 })
  await page.evaluate(async () => {
    for (let top = 0; top < document.documentElement.scrollHeight; top += 700) {
      window.scrollTo(0, top)
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    window.scrollTo(0, 0)
  })

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

  if (!metrics.heading.toLowerCase().includes(expectedHeading.toLowerCase())) {
    throw new Error(`${slug}/${viewport.label}: expected heading “${expectedHeading}”, got “${metrics.heading}”`)
  }
  if (metrics.scrollWidth > metrics.width + 1) {
    throw new Error(`${slug}/${viewport.label}: horizontal overflow ${metrics.scrollWidth}px > ${metrics.width}px`)
  }
  if (metrics.imageFailures.length) {
    throw new Error(`${slug}/${viewport.label}: failed images ${metrics.imageFailures.join(', ')}`)
  }

  const screenshotPath = fileURLToPath(new URL(`${slug}-${viewport.label}.png`, output))
  await page.screenshot({ path: screenshotPath, fullPage: true })

  if (slug === 'info-cards') {
    const initialCount = await page.$$eval('.info-guide-card', (cards) => cards.length)
    if (initialCount !== 12) throw new Error(`${slug}/${viewport.label}: expected 12 initial cards, got ${initialCount}`)
    await page.click('.info-load-more')
    const loadedCount = await page.$$eval('.info-guide-card', (cards) => cards.length)
    if (loadedCount !== 24) throw new Error(`${slug}/${viewport.label}: expected 24 loaded cards, got ${loadedCount}`)
  }

  if (slug === 'coa-process') {
    const before = await page.$eval('.coa-carousel > img', (image) => image.src)
    await page.click('.coa-carousel > button[aria-label="Next COA page"]')
    const after = await page.$eval('.coa-carousel > img', (image) => image.src)
    if (before === after) throw new Error(`${slug}/${viewport.label}: COA carousel did not advance`)
  }

  if (slug === 'dilution-guide') {
    await page.click('.dilution-chart-button')
    const visible = await page.$eval('.dilution-lightbox', (node) => getComputedStyle(node).display !== 'none')
    if (!visible) throw new Error(`${slug}/${viewport.label}: dilution chart lightbox did not open`)
    await page.click('.dilution-lightbox-close')
    const closed = await page.$('.dilution-lightbox')
    if (closed) throw new Error(`${slug}/${viewport.label}: dilution chart lightbox did not close`)
  }

  results.push({ slug, viewport: viewport.label, ...metrics, screenshot: screenshotPath })
  await page.close()
}

try {
  for (const [slug, expectedHeading] of pages) {
    await capture(slug, expectedHeading, { label: 'desktop', width: 1440, height: 1000 })
    await capture(slug, expectedHeading, { label: 'mobile', width: 390, height: 844 })
  }

  const navPage = await browser.newPage()
  await navPage.setViewport({ width: 1600, height: 900 })
  await navPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle0', timeout: 30_000 })
  await navPage.evaluate(() => {
    const group = [...document.querySelectorAll('.nav-group')]
      .find((node) => node.querySelector(':scope > button')?.textContent.includes('Peptide Info'))
    group?.querySelector('a[href="/dilution-guide/"]')?.click()
  })
  await navPage.waitForFunction(() => window.location.pathname === '/dilution-guide/')
  results.push({ peptideInfoNavigation: await navPage.evaluate(() => window.location.pathname) })
  await navPage.close()

  if (consoleErrors.length) throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`)
  await fs.writeFile(new URL('results.json', output), JSON.stringify({ results, consoleErrors }, null, 2))
  console.log('Peptide Info QA passed (8 responsive checks, card loading, carousel, lightbox, and navigation).')
} finally {
  await browser.close()
}
