import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const root = path.resolve(import.meta.dirname, '..')
const outputDir = path.join(root, 'preview', 'reference-peptide-info')
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

await fs.mkdir(outputDir, { recursive: true })

const clean = (value) => value?.replace(/\s+/g, ' ').trim() || ''
const audit = {}

async function settle(page) {
  await new Promise((resolve) => setTimeout(resolve, 2800))
  for (const label of ['Yes, I’m 21 and above', "Yes, I'm 21 and above", 'Deny']) {
    const candidates = await page.$$('button, a')
    for (const candidate of candidates) {
      const text = clean(await candidate.evaluate((node) => node.textContent))
      if (text === label && await candidate.isVisible()) {
        await candidate.click()
        await new Promise((resolve) => setTimeout(resolve, 500))
        break
      }
    }
  }
}

async function scrollForLazyImages(page) {
  await page.evaluate(async () => {
    for (const image of document.querySelectorAll('img')) {
      const source = image.dataset.lazySrc || image.dataset.src || image.getAttribute('data-lazy-src') || image.getAttribute('data-src')
      const sourceSet = image.dataset.lazySrcset || image.dataset.srcset || image.getAttribute('data-lazy-srcset') || image.getAttribute('data-srcset')
      if (source) image.src = source
      if (sourceSet) image.srcset = sourceSet
      image.loading = 'eager'
    }
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 180))
    }
    window.scrollTo(0, 0)
  })
  await new Promise((resolve) => setTimeout(resolve, 1800))
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  await page.goto('https://purehealthpeptides.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await settle(page)
  audit.route = await page.evaluate(() => {
    const normalize = (value) => value?.replace(/\s+/g, ' ').trim().toLowerCase() || ''
    return [...document.querySelectorAll('a[href]')]
      .find((node) => normalize(node.textContent) === 'product info')?.href || ''
  })
  if (!audit.route) throw new Error('Could not resolve Product Info route from the live navigation')

  await page.goto(audit.route, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await settle(page)
  await scrollForLazyImages(page)

  audit.desktop = await page.evaluate(() => {
    const cleanText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
    const main = document.querySelector('main') || document.querySelector('#content') || document.body
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
    const hrefInfo = (node) => ({ text: cleanText(node.textContent), href: node.href, download: node.getAttribute('download') })
    const styleInfo = (node) => {
      if (!node) return null
      const style = getComputedStyle(node)
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        border: style.border,
        boxShadow: style.boxShadow,
        gap: style.gap,
        gridTemplateColumns: style.gridTemplateColumns,
        textTransform: style.textTransform,
      }
    }
    const cards = [...main.querySelectorAll('article, .e-loop-item, [class*="card"], [class*="item"]')]
      .filter(visible)
      .map((node) => {
        const title = node.querySelector('h2,h3,h4')
        const image = node.querySelector('img')
        const download = [...node.querySelectorAll('a[href]')].find((link) => /download/i.test(link.textContent))
        return title && download ? {
          title: cleanText(title.textContent),
          box: box(node),
          image: image ? {
            src: image.currentSrc || image.src,
            alt: image.alt,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            box: box(image),
          } : null,
          download: hrefInfo(download),
        } : null
      })
      .filter(Boolean)
    const backgrounds = [...document.querySelectorAll('body *')]
      .filter(visible)
      .map((node) => ({ node, value: getComputedStyle(node).backgroundImage }))
      .filter(({ value }) => value && value !== 'none' && /url\(/.test(value))
      .map(({ node, value }) => ({ tag: node.tagName, className: node.className?.toString() || '', value, box: box(node) }))
    return {
      url: location.href,
      title: document.title,
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      headings: [...main.querySelectorAll('h1,h2,h3,h4')].filter(visible).map((node) => ({ tag: node.tagName, text: cleanText(node.textContent), box: box(node) })),
      paragraphs: [...main.querySelectorAll('p')].filter(visible).map((node) => cleanText(node.textContent)).filter(Boolean),
      inputs: [...main.querySelectorAll('input,textarea,select')].filter(visible).map((node) => ({ tag: node.tagName, type: node.type || '', placeholder: node.placeholder || '', ariaLabel: node.getAttribute('aria-label') || '', box: box(node) })),
      allInputs: [...main.querySelectorAll('input,textarea,select')].map((node) => ({ tag: node.tagName, type: node.type || '', placeholder: node.placeholder || '', ariaLabel: node.getAttribute('aria-label') || '', visible: visible(node) })),
      buttons: [...main.querySelectorAll('button')].filter(visible).map((node) => ({ text: cleanText(node.textContent), box: box(node) })),
      loadMoreMarkup: [...main.querySelectorAll('button,a')].filter((node) => cleanText(node.textContent) === 'Load More').map((node) => ({ tag: node.tagName, className: node.className, outerHTML: node.outerHTML })),
      downloadLinks: [...main.querySelectorAll('a[href]')].filter((node) => visible(node) && /download/i.test(node.textContent)).map(hrefInfo),
      cards,
      images: [...main.querySelectorAll('img')].filter(visible).map((node) => ({ src: node.currentSrc || node.src, alt: node.alt, naturalWidth: node.naturalWidth, naturalHeight: node.naturalHeight, box: box(node) })),
      backgrounds,
      layout: (() => {
        const firstCard = main.querySelector('.e-loop-item')
        const firstTitle = firstCard?.querySelector('h2,h3,h4')
        const firstDownload = firstCard ? [...firstCard.querySelectorAll('a[href]')].find((link) => /download/i.test(link.textContent)) : null
        const grid = firstCard?.parentElement
        const heroHeading = [...main.querySelectorAll('h1,h2')].find((node) => cleanText(node.textContent) === 'Product Info Cards')
        return {
          grid: grid ? { box: box(grid), className: grid.className, style: styleInfo(grid) } : null,
          card: firstCard ? { box: box(firstCard), className: firstCard.className, style: styleInfo(firstCard) } : null,
          cardTitle: firstTitle ? { box: box(firstTitle), style: styleInfo(firstTitle) } : null,
          download: firstDownload ? { box: box(firstDownload), style: styleInfo(firstDownload) } : null,
          heroHeading: heroHeading ? { box: box(heroHeading), style: styleInfo(heroHeading) } : null,
        }
      })(),
    }
  })

  await page.screenshot({ path: path.join(outputDir, 'product-info-desktop.png'), fullPage: true })

  audit.interactions = {}
  const searchInput = await page.$('main input[type="search"], #content input[type="search"], input[type="search"]')
  if (searchInput && await searchInput.isVisible()) {
    await searchInput.type('BPC')
    await new Promise((resolve) => setTimeout(resolve, 800))
    audit.interactions.search = await page.evaluate(() => {
      const cleanText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
      const visible = (node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      return {
        value: document.querySelector('input[type="search"]')?.value || '',
        headings: [...document.querySelectorAll('main h2,main h3,main h4,#content h2,#content h3,#content h4')].filter(visible).map((node) => cleanText(node.textContent)),
        visibleDownloads: [...document.querySelectorAll('main a,#content a')].filter((node) => visible(node) && /download/i.test(node.textContent)).length,
      }
    })
    await page.screenshot({ path: path.join(outputDir, 'product-info-search-desktop.png'), fullPage: false })
    await searchInput.click({ clickCount: 3 })
    await searchInput.press('Backspace')
    await new Promise((resolve) => setTimeout(resolve, 700))
  }

  const initialCount = audit.desktop.downloadLinks.length
  const batches = [initialCount]
  for (let round = 0; round < 10; round += 1) {
    const loadMoreCandidates = await page.$$('button, a')
    let loadMore = null
    for (const candidate of loadMoreCandidates) {
      const label = clean(await candidate.evaluate((node) => node.textContent))
      if (label === 'Load More' && await candidate.isVisible()) {
        loadMore = candidate
        break
      }
    }
    if (!loadMore) break
    await loadMore.click()
    await new Promise((resolve) => setTimeout(resolve, 2600))
    const nextCount = await page.$$eval('main a, #content a', (links) => links.filter((node) => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return /download/i.test(node.textContent) && rect.width > 0 && rect.height > 0 && style.display !== 'none'
    }).length)
    if (nextCount === batches.at(-1)) break
    batches.push(nextCount)
  }
  const stateAfterLoad = await page.evaluate(() => {
    const cleanText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
    const visible = (node) => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const scope = document.querySelector('main') || document.querySelector('#content') || document.body
    const itemNodes = [...scope.querySelectorAll('.e-loop-item')].filter(visible)
    return {
      downloads: [...scope.querySelectorAll('a')].filter((node) => visible(node) && /download/i.test(node.textContent)).length,
      productHeadings: [...scope.querySelectorAll('h2,h3,h4')].filter(visible).map((node) => cleanText(node.textContent)),
      loadMoreVisible: [...scope.querySelectorAll('button,a')].some((node) => cleanText(node.textContent) === 'Load More' && visible(node)),
      inventory: itemNodes.map((node) => {
        const title = node.querySelector('h2,h3,h4')
        const image = node.querySelector('img')
        const download = [...node.querySelectorAll('a[href]')].find((link) => /download/i.test(link.textContent))
        return {
          title: cleanText(title?.textContent),
          image: image ? (image.dataset.lazySrc || image.dataset.src || image.getAttribute('data-lazy-src') || image.getAttribute('data-src') || image.currentSrc || image.src) : '',
          imageAlt: image?.alt || '',
          imageWidth: Number(image?.getAttribute('width')) || image?.naturalWidth || 0,
          imageHeight: Number(image?.getAttribute('height')) || image?.naturalHeight || 0,
          download: download?.href || '',
        }
      }).filter((item) => item.title && item.download),
    }
  })
  audit.interactions.loadMore = { before: initialCount, after: stateAfterLoad.downloads, batches, ...stateAfterLoad }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.goto(audit.route, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await settle(page)
  await scrollForLazyImages(page)
  audit.mobile = await page.evaluate(() => {
    const cleanText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
    const main = document.querySelector('main') || document.querySelector('#content') || document.body
    const box = (node) => {
      const rect = node.getBoundingClientRect()
      return { x: Math.round(rect.x), y: Math.round(rect.y + scrollY), width: Math.round(rect.width), height: Math.round(rect.height) }
    }
    const styleInfo = (node) => {
      const style = getComputedStyle(node)
      return { fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, color: style.color, backgroundColor: style.backgroundColor, borderRadius: style.borderRadius, gap: style.gap, gridTemplateColumns: style.gridTemplateColumns }
    }
    const firstCard = main.querySelector('.e-loop-item')
    const firstImage = firstCard?.querySelector('img')
    const firstTitle = firstCard?.querySelector('h2,h3,h4')
    const firstDownload = firstCard ? [...firstCard.querySelectorAll('a[href]')].find((link) => /download/i.test(link.textContent)) : null
    const grid = firstCard?.parentElement
    const hero = [...document.querySelectorAll('body *')].find((node) => /about-us-bg\.jpg/.test(getComputedStyle(node).backgroundImage))
    const heroHeading = [...main.querySelectorAll('h1,h2')].find((node) => cleanText(node.textContent) === 'Product Info Cards')
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      hero: hero ? { box: box(hero), style: styleInfo(hero) } : null,
      heroHeading: heroHeading ? { box: box(heroHeading), style: styleInfo(heroHeading) } : null,
      grid: grid ? { box: box(grid), style: styleInfo(grid) } : null,
      card: firstCard ? { box: box(firstCard), style: styleInfo(firstCard) } : null,
      image: firstImage ? box(firstImage) : null,
      title: firstTitle ? { box: box(firstTitle), style: styleInfo(firstTitle) } : null,
      download: firstDownload ? { box: box(firstDownload), style: styleInfo(firstDownload) } : null,
    }
  })
  await page.screenshot({ path: path.join(outputDir, 'product-info-mobile.png'), fullPage: true })
  await page.close()
} finally {
  await browser.close()
}

await fs.writeFile(path.join(outputDir, 'product-info-audit.json'), JSON.stringify(audit, null, 2))
console.log(JSON.stringify({
  route: audit.route,
  title: audit.desktop?.title,
  document: audit.desktop?.document,
  headings: audit.desktop?.headings.map(({ tag, text }) => ({ tag, text })),
  inputs: audit.desktop?.inputs,
  buttons: audit.desktop?.buttons,
  cards: audit.desktop?.cards.length,
  downloads: audit.desktop?.downloadLinks.length,
  interactions: audit.interactions,
  mobile: audit.mobile,
}, null, 2))
