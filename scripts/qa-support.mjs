import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const baseUrl = 'http://127.0.0.1:4173'
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const output = new URL('../preview/support-qa/', import.meta.url)
const pages = [
  ['my-account', 'Login'],
  ['track-my-order', 'Track Order'],
  ['faqs', 'frequently asked questions'],
  ['contact-us', 'Send us a message'],
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

  const metrics = await page.evaluate(() => ({
    heading: document.querySelector('main h1')?.textContent.trim() || '',
    title: document.title,
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    imageFailures: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
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

  await page.evaluate(async () => {
    for (let top = 0; top < document.documentElement.scrollHeight; top += 700) {
      window.scrollTo(0, top)
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    window.scrollTo(0, 0)
  })
  const screenshotPath = fileURLToPath(new URL(`${slug}-${viewport.label}.png`, output))
  await page.screenshot({ path: screenshotPath, fullPage: true })
  results.push({ slug, viewport: viewport.label, ...metrics, screenshot: screenshotPath })

  if (slug === 'my-account') {
    await page.type('input[name="username"]', 'researcher@example.com')
    await page.click('.account-login-actions button:first-child')
    const status = await page.$eval('.support-form-status', (node) => node.textContent)
    if (!status.includes('OTP')) throw new Error(`${slug}/${viewport.label}: OTP status not shown`)
  }
  if (slug === 'track-my-order') {
    await page.type('input[name="orderid"]', 'PHP-10001')
    await page.type('input[name="order_email"]', 'researcher@example.com')
    await page.click('.track-content button[type="submit"]')
    const status = await page.$eval('.support-form-status', (node) => node.textContent)
    if (!status.includes('Order lookup')) throw new Error(`${slug}/${viewport.label}: tracking status not shown`)
  }
  if (slug === 'faqs') {
    const count = await page.$$eval('.faq-category article', (items) => items.length)
    if (count !== 60) throw new Error(`${slug}/${viewport.label}: expected 60 questions, got ${count}`)
    const secondButton = await page.$('.faq-category article:nth-of-type(2) > button')
    await secondButton.click()
    const expanded = await secondButton.evaluate((button) => button.getAttribute('aria-expanded'))
    if (expanded !== 'true') throw new Error(`${slug}/${viewport.label}: accordion did not expand`)
  }
  if (slug === 'contact-us') {
    await page.type('#support-full-name', 'QA Researcher')
    await page.type('#support-email', 'researcher@example.com')
    await page.type('#support-message', 'Local form validation test.')
    await page.click('.contact-content button[type="submit"]')
    const status = await page.$eval('.support-form-status', (node) => node.textContent)
    if (!status.includes('Contact form delivery')) throw new Error(`${slug}/${viewport.label}: contact service status not shown`)
  }

  await page.close()
}

try {
  for (const [slug, expectedHeading] of pages) {
    await capture(slug, expectedHeading, { label: 'desktop', width: 1440, height: 1000 })
    await capture(slug, expectedHeading, { label: 'mobile', width: 390, height: 844 })
  }

  const navPage = await browser.newPage()
  await navPage.setViewport({ width: 1600, height: 900 })
  await navPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' })
  await navPage.evaluate(() => {
    const group = [...document.querySelectorAll('.nav-group')].find((node) => node.querySelector(':scope > button')?.textContent.includes('Support'))
    group?.querySelector('a[href="/faqs/"]')?.click()
  })
  await navPage.waitForFunction(() => window.location.pathname === '/faqs/')
  results.push({ supportNavigation: await navPage.evaluate(() => window.location.pathname) })
  await navPage.close()

  if (consoleErrors.length) throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`)
  await fs.writeFile(new URL('results.json', output), JSON.stringify({ results, consoleErrors }, null, 2))
  console.log('Support QA passed (8 responsive checks, 60 FAQs, form interactions, and navigation).')
} finally {
  await browser.close()
}
