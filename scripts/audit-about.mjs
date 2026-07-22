import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const root = path.resolve(import.meta.dirname, '..')
const outputDir = path.join(root, 'preview', 'reference-about')
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const routes = [
  ['about-us', 'https://purehealthpeptides.com/about-us/'],
  ['research-areas', 'https://purehealthpeptides.com/research-areas/'],
  ['news', 'https://purehealthpeptides.com/news/'],
  ['pure-elite-access', 'https://purehealthpeptides.com/pure-elite-access/'],
]

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

await fs.mkdir(outputDir, { recursive: true })
const audit = {}

try {
  for (const [slug, url] of routes) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await new Promise((resolve) => setTimeout(resolve, 3500))
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 650) {
        window.scrollTo(0, y)
        await new Promise((resolve) => setTimeout(resolve, 90))
      }
    })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await page.evaluate(() => window.scrollTo(0, 0))

    audit[slug] = await page.evaluate(() => {
      const main = document.querySelector('main') || document.querySelector('#content') || document.body
      const clean = (value) => value?.replace(/\s+/g, ' ').trim() || ''
      const visible = (node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const box = (node) => {
        const rect = node.getBoundingClientRect()
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y + scrollY),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      }

      const backgrounds = []
      for (const node of main.querySelectorAll('*')) {
        if (!visible(node)) continue
        const image = getComputedStyle(node).backgroundImage
        const rect = node.getBoundingClientRect()
        if (image && image !== 'none' && rect.width * rect.height > 10_000) {
          backgrounds.push({ tag: node.tagName, className: String(node.className || ''), image, box: box(node) })
        }
      }

      const sections = [...main.querySelectorAll('section, article')]
        .filter(visible)
        .map((node) => ({
          tag: node.tagName,
          className: String(node.className || ''),
          heading: clean(node.querySelector('h1,h2,h3,h4')?.textContent),
          box: box(node),
        }))
        .filter((item) => item.heading || item.box.height > 200)

      return {
        title: document.title,
        bodyClass: document.body.className,
        viewport: { width: innerWidth, height: innerHeight },
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        mainBox: box(main),
        headings: [...main.querySelectorAll('h1,h2,h3,h4,h5')]
          .filter(visible)
          .map((node) => ({ tag: node.tagName, text: clean(node.textContent), box: box(node) })),
        paragraphs: [...main.querySelectorAll('p')]
          .filter(visible)
          .map((node) => clean(node.textContent))
          .filter(Boolean),
        listItems: [...main.querySelectorAll('li')]
          .filter(visible)
          .map((node) => clean(node.textContent))
          .filter(Boolean),
        links: [...main.querySelectorAll('a[href]')]
          .filter(visible)
          .map((node) => ({ text: clean(node.textContent), href: node.href }))
          .filter((item) => item.text),
        images: [...main.querySelectorAll('img')]
          .filter(visible)
          .map((node) => ({
            src: node.currentSrc || node.src,
            alt: node.alt,
            naturalWidth: node.naturalWidth,
            naturalHeight: node.naturalHeight,
            box: box(node),
          })),
        backgrounds: backgrounds.filter((item, index, all) =>
          all.findIndex((candidate) => candidate.image === item.image && candidate.box.y === item.box.y) === index,
        ),
        sections,
      }
    })

    await page.screenshot({ path: path.join(outputDir, `${slug}-desktop.png`), fullPage: true })
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: path.join(outputDir, `${slug}-mobile.png`), fullPage: false })
    audit[slug].mobile = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      headings: [...document.querySelectorAll('main h1, main h2')]
        .filter((node) => {
          const rect = node.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        })
        .slice(0, 5)
        .map((node) => ({ text: node.textContent.replace(/\s+/g, ' ').trim(), width: Math.round(node.getBoundingClientRect().width), height: Math.round(node.getBoundingClientRect().height) })),
    }))
    await page.close()
  }
} finally {
  await browser.close()
}

await fs.writeFile(path.join(outputDir, 'audit.json'), JSON.stringify(audit, null, 2))
const summary = Object.fromEntries(Object.entries(audit).map(([slug, item]) => [slug, {
  title: item.title,
  document: item.document,
  headings: item.headings.map((heading) => heading.text),
  imageCount: item.images.length,
  backgrounds: item.backgrounds.map((background) => background.image),
  mobile: item.mobile,
}]))
console.log(JSON.stringify(summary, null, 2))
