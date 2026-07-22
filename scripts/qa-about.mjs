import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const baseUrl = 'http://127.0.0.1:4173'
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const output = new URL('../preview/about-qa/', import.meta.url)
const pages = [
  ['about-us', 'About US'],
  ['research-areas', 'Research Areas'],
  ['news', 'Recent news'],
  ['pure-elite-access', 'PURE ELITE ACCESS'],
]

await fs.mkdir(output, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const results = []

try {
  for (const [slug, expectedHeading] of pages) {
    for (const viewport of [
      { label: 'desktop', width: 1440, height: 1000 },
      { label: 'mobile', width: 390, height: 844 },
    ]) {
      const page = await browser.newPage()
      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })
      await page.goto(`${baseUrl}/${slug}/`, { waitUntil: 'networkidle0', timeout: 30_000 })
      await page.evaluate(async () => {
        for (let top = 0; top < document.documentElement.scrollHeight; top += 700) {
          window.scrollTo(0, top)
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
        window.scrollTo(0, 0)
      })

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

      if (slug === 'pure-elite-access') {
        const faqButton = await page.$('.elite-faq article:nth-of-type(2) > button')
        await faqButton.evaluate((button) => button.scrollIntoView({ block: 'center' }))
        await faqButton.click()
        await page.waitForFunction(
          () => document.querySelector('.elite-faq article:nth-of-type(2) > button')?.getAttribute('aria-expanded') === 'true',
          { timeout: 5_000 },
        )
        const expanded = await faqButton.evaluate((button) => button.getAttribute('aria-expanded'))
        if (expanded !== 'true') throw new Error(`${slug}/${viewport.label}: FAQ did not expand`)
        await page.evaluate(() => window.scrollTo(0, 0))
      }

      const screenshot = new URL(`${slug}-${viewport.label}.png`, output)
      const screenshotPath = fileURLToPath(screenshot)
      await page.screenshot({ path: screenshotPath, fullPage: true })
      results.push({ slug, viewport: viewport.label, ...metrics, screenshot: screenshotPath })
      await page.close()
    }
  }

  const navPage = await browser.newPage()
  await navPage.setViewport({ width: 1600, height: 900 })
  await navPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' })
  await navPage.hover('.nav-group')
  await navPage.click('.nav-group .nav-dropdown a[href="/about-us/"]')
  await navPage.waitForFunction(() => window.location.pathname === '/about-us/')
  results.push({ desktopNavigation: await navPage.evaluate(() => window.location.pathname) })
  await navPage.close()

  await fs.writeFile(new URL('results.json', output), JSON.stringify(results, null, 2))
  console.log(`About QA passed (${pages.length * 2} responsive page checks + navigation).`)
} finally {
  await browser.close()
}
