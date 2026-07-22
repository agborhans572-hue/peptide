import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const root = path.resolve(import.meta.dirname, '..')
const outputDir = path.join(root, 'preview', 'reference-support')
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const targetLabels = ['My Account', 'Track My Order', 'FAQs', 'Contact']

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

await fs.mkdir(outputDir, { recursive: true })
const audit = { routes: {}, pages: {} }

try {
  const routePage = await browser.newPage()
  await routePage.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
  await routePage.goto('https://purehealthpeptides.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await new Promise((resolve) => setTimeout(resolve, 2500))
  audit.routes = await routePage.evaluate((labels) => {
    const routes = {}
    for (const label of labels) {
      const link = [...document.querySelectorAll('a[href]')].find((node) => node.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === label.toLowerCase())
      routes[label] = link?.href || ''
    }
    return routes
  }, targetLabels)
  await routePage.close()

  for (const [label, url] of Object.entries(audit.routes)) {
    if (!url) throw new Error(`Could not resolve the live route for ${label}`)
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await new Promise((resolve) => setTimeout(resolve, 3200))
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 650) {
        window.scrollTo(0, y)
        await new Promise((resolve) => setTimeout(resolve, 80))
      }
      window.scrollTo(0, 0)
    })
    await new Promise((resolve) => setTimeout(resolve, 700))

    audit.pages[slug] = await page.evaluate(() => {
      const main = document.querySelector('main') || document.querySelector('#content') || document.body
      const clean = (value) => value?.replace(/\s+/g, ' ').trim() || ''
      const visible = (node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const box = (node) => {
        const rect = node.getBoundingClientRect()
        return { x: Math.round(rect.x), y: Math.round(rect.y + scrollY), width: Math.round(rect.width), height: Math.round(rect.height) }
      }
      return {
        url: location.href,
        title: document.title,
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        headings: [...main.querySelectorAll('h1,h2,h3,h4')].filter(visible).map((node) => ({ tag: node.tagName, text: clean(node.textContent), box: box(node) })),
        paragraphs: [...main.querySelectorAll('p')].filter(visible).map((node) => clean(node.textContent)).filter(Boolean),
        listItems: [...main.querySelectorAll('li')].filter(visible).map((node) => clean(node.textContent)).filter(Boolean),
        fields: [...main.querySelectorAll('input,textarea,select')].filter(visible).map((node) => ({ tag: node.tagName, type: node.type || '', name: node.name || '', placeholder: node.placeholder || '', ariaLabel: node.getAttribute('aria-label') || '', box: box(node) })),
        labels: [...main.querySelectorAll('label')].filter(visible).map((node) => clean(node.textContent)).filter(Boolean),
        buttons: [...main.querySelectorAll('button,input[type="submit"]')].filter(visible).map((node) => ({ text: clean(node.textContent || node.value), box: box(node) })),
        links: [...main.querySelectorAll('a[href]')].filter(visible).map((node) => ({ text: clean(node.textContent), href: node.href })).filter((item) => item.text),
        images: [...main.querySelectorAll('img')].filter(visible).map((node) => ({ src: node.currentSrc || node.src, alt: node.alt, naturalWidth: node.naturalWidth, naturalHeight: node.naturalHeight, box: box(node) })),
      }
    })

    await page.screenshot({ path: path.join(outputDir, `${slug}-desktop.png`), fullPage: true })
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 800))
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: path.join(outputDir, `${slug}-mobile.png`), fullPage: false })
    audit.pages[slug].mobile = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }))
    await page.close()
  }
} finally {
  await browser.close()
}

await fs.writeFile(path.join(outputDir, 'audit.json'), JSON.stringify(audit, null, 2))
console.log(JSON.stringify({
  routes: audit.routes,
  pages: Object.fromEntries(Object.entries(audit.pages).map(([slug, page]) => [slug, {
    title: page.title,
    document: page.document,
    headings: page.headings.map((item) => item.text),
    fields: page.fields,
    buttons: page.buttons.map((item) => item.text),
    images: page.images.length,
    mobile: page.mobile,
  }])),
}, null, 2))
