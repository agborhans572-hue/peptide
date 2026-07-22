import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const root = path.resolve(import.meta.dirname, '..')
const outputDir = path.join(root, 'preview', 'reference-peptide-info')
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const routes = [
  { key: 'coa-process', url: 'https://purehealthpeptides.com/coa-process/' },
  { key: 'manufacturing', url: 'https://purehealthpeptides.com/manufacturing/' },
]

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

await fs.mkdir(outputDir, { recursive: true })

const clean = (value) => value?.replace(/\s+/g, ' ').trim() || ''

async function settle(page) {
  await new Promise((resolve) => setTimeout(resolve, 2400))
  const candidates = await page.$$('button, a')
  for (const candidate of candidates) {
    const text = clean(await candidate.evaluate((node) => node.textContent))
    if (["Yes, I’m 21 and above", "Yes, I'm 21 and above"].includes(text) && await candidate.isVisible()) {
      await candidate.click()
      await new Promise((resolve) => setTimeout(resolve, 500))
      break
    }
  }
}

async function loadEverything(page) {
  await page.evaluate(async () => {
    for (const image of document.querySelectorAll('img')) {
      const source = image.dataset.lazySrc || image.dataset.src || image.getAttribute('data-lazy-src') || image.getAttribute('data-src')
      const sourceSet = image.dataset.lazySrcset || image.dataset.srcset || image.getAttribute('data-lazy-srcset') || image.getAttribute('data-srcset')
      if (source) image.src = source
      if (sourceSet) image.srcset = sourceSet
      image.loading = 'eager'
    }
    for (let y = 0; y < document.documentElement.scrollHeight; y += 650) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    window.scrollTo(0, 0)
  })
  await new Promise((resolve) => setTimeout(resolve, 1800))
}

async function extract(page) {
  return page.evaluate(() => {
    const cleanText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
    const visible = (node) => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
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
    const style = (node) => {
      const css = getComputedStyle(node)
      return {
        fontFamily: css.fontFamily,
        fontSize: css.fontSize,
        fontWeight: css.fontWeight,
        lineHeight: css.lineHeight,
        letterSpacing: css.letterSpacing,
        color: css.color,
        backgroundColor: css.backgroundColor,
        textAlign: css.textAlign,
        borderRadius: css.borderRadius,
        gridTemplateColumns: css.gridTemplateColumns,
        gap: css.gap,
      }
    }
    const main = document.querySelector('main') || document.querySelector('#content') || document.body
    const backgroundNodes = [...document.querySelectorAll('body *')]
      .filter(visible)
      .map((node) => ({ node, backgroundImage: getComputedStyle(node).backgroundImage }))
      .filter(({ backgroundImage }) => backgroundImage && backgroundImage !== 'none' && /url\(/.test(backgroundImage))
      .map(({ node, backgroundImage }) => ({
        tag: node.tagName,
        className: node.className?.toString() || '',
        backgroundImage,
        box: box(node),
      }))
    const images = [...main.querySelectorAll('img')].filter(visible).map((node) => ({
      src: node.currentSrc || node.src,
      source: node.dataset.lazySrc || node.dataset.src || node.getAttribute('data-lazy-src') || node.getAttribute('data-src') || '',
      alt: node.alt,
      naturalWidth: node.naturalWidth,
      naturalHeight: node.naturalHeight,
      widthAttribute: node.getAttribute('width'),
      heightAttribute: node.getAttribute('height'),
      box: box(node),
    }))
    return {
      url: location.href,
      title: document.title,
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      headings: [...main.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((node) => ({
        tag: node.tagName,
        text: cleanText(node.textContent),
        box: box(node),
        style: style(node),
      })),
      paragraphs: [...main.querySelectorAll('p')].filter(visible).map((node) => ({
        text: cleanText(node.textContent),
        box: box(node),
        style: style(node),
      })).filter(({ text }) => text),
      listItems: [...main.querySelectorAll('li')].filter(visible).map((node) => ({
        text: cleanText(node.textContent),
        box: box(node),
      })).filter(({ text }) => text),
      buttons: [...main.querySelectorAll('button')].filter(visible).map((node) => ({
        text: cleanText(node.textContent),
        ariaExpanded: node.getAttribute('aria-expanded'),
        box: box(node),
      })),
      links: [...main.querySelectorAll('a[href]')].filter(visible).map((node) => ({
        text: cleanText(node.textContent),
        href: node.href,
        box: box(node),
      })).filter(({ text }) => text),
      images,
      backgrounds: backgroundNodes,
      sections: [...main.querySelectorAll('section, .elementor-element.e-con, .elementor-section')].filter(visible).map((node) => ({
        id: node.id,
        className: node.className?.toString() || '',
        text: cleanText(node.textContent).slice(0, 180),
        box: box(node),
        style: style(node),
      })).filter(({ box: rect }) => rect.height > 80),
    }
  })
}

const audit = {}

try {
  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(60_000)

  for (const route of routes) {
    audit[route.key] = {}
    for (const viewport of [
      { key: 'desktop', width: 1440, height: 1000 },
      { key: 'mobile', width: 390, height: 844 },
    ]) {
      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })
      await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await settle(page)
      await loadEverything(page)
      audit[route.key][viewport.key] = await extract(page)
      await page.screenshot({
        path: path.join(outputDir, `${route.key}-${viewport.key}.png`),
        fullPage: true,
      })
    }
  }
  await page.close()
} finally {
  await browser.close()
}

await fs.writeFile(path.join(outputDir, 'process-manufacturing-audit.json'), JSON.stringify(audit, null, 2))

const summary = Object.fromEntries(Object.entries(audit).map(([key, value]) => [key, {
  desktop: value.desktop.document,
  mobile: value.mobile.document,
  headings: value.desktop.headings.map(({ tag, text }) => ({ tag, text })),
  images: value.desktop.images,
  backgrounds: value.desktop.backgrounds,
  buttons: value.desktop.buttons,
}]))

console.log(JSON.stringify(summary, null, 2))
