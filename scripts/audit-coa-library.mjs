import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const root = path.resolve(import.meta.dirname, '..')
const outputDir = path.join(root, 'preview', 'reference-coa-library')
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const route = 'https://purehealthpeptides.com/coa-library/'

await fs.mkdir(outputDir, { recursive: true })

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

const clean = (value) => value?.replace(/\s+/g, ' ').trim() || ''

async function settle(page) {
  await new Promise((resolve) => setTimeout(resolve, 2500))
  for (const label of ['Yes, I’m 21 and above', "Yes, I'm 21 and above", 'Deny']) {
    for (const candidate of await page.$$('button, a')) {
      if (clean(await candidate.evaluate((node) => node.textContent)) === label && await candidate.isVisible()) {
        await candidate.click()
        await new Promise((resolve) => setTimeout(resolve, 2000))
        break
      }
    }
  }
}

async function prepare(page) {
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await settle(page)
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
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    window.scrollTo(0, 0)
  })
  await new Promise((resolve) => setTimeout(resolve, 1200))
}

async function pageSnapshot(page) {
  return page.evaluate(() => {
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
    const styleInfo = (node) => {
      const style = getComputedStyle(node)
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textTransform: style.textTransform,
        textAlign: style.textAlign,
        color: style.color,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        border: style.border,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        padding: style.padding,
        margin: style.margin,
        gap: style.gap,
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
      }
    }

    const headings = [...main.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible)
    const controls = [...main.querySelectorAll('button,input,select,textarea,a[href]')].filter(visible)
    const accordionCandidates = [...main.querySelectorAll('[class*="accordion"], [class*="toggle"], details')]
      .filter(visible)
      .map((node) => ({
        tag: node.tagName,
        className: node.className?.toString() || '',
        text: cleanText(node.textContent).slice(0, 500),
        box: box(node),
        links: [...node.querySelectorAll('a[href]')].map((link) => ({ text: cleanText(link.textContent), href: link.href, target: link.target })),
      }))

    const documentLinks = [...main.querySelectorAll('a[href]')]
      .filter((link) => /\.pdf(?:$|\?)/i.test(link.href) || /coa|batch|lot|view|download/i.test(cleanText(link.textContent)))
      .map((link) => ({
        text: cleanText(link.textContent),
        href: link.href,
        target: link.target,
        download: link.getAttribute('download'),
        className: link.className?.toString() || '',
        visible: visible(link),
        box: visible(link) ? box(link) : null,
      }))

    return {
      url: location.href,
      title: document.title,
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      main: { box: box(main), className: main.className?.toString() || '', style: styleInfo(main) },
      headings: headings.map((node) => ({ tag: node.tagName, text: cleanText(node.textContent), box: box(node), style: styleInfo(node) })),
      paragraphs: [...main.querySelectorAll('p')].filter(visible).map((node) => ({ text: cleanText(node.textContent), box: box(node), style: styleInfo(node) })),
      lists: [...main.querySelectorAll('ol,ul')].filter(visible).map((node) => ({
        ordered: node.tagName === 'OL',
        items: [...node.children].filter((item) => item.matches('li')).map((item) => cleanText(item.textContent)),
        box: box(node),
      })),
      controls: controls.map((node) => ({
        tag: node.tagName,
        type: node.type || '',
        text: cleanText(node.textContent),
        value: node.value || '',
        placeholder: node.placeholder || '',
        ariaLabel: node.getAttribute('aria-label') || '',
        href: node.href || '',
        target: node.target || '',
        className: node.className?.toString() || '',
        box: box(node),
        style: styleInfo(node),
      })),
      images: [...main.querySelectorAll('img')].filter(visible).map((node) => ({
        src: node.currentSrc || node.src,
        alt: node.alt,
        naturalWidth: node.naturalWidth,
        naturalHeight: node.naturalHeight,
        box: box(node),
      })),
      backgrounds: [...main.querySelectorAll('*')].filter(visible).map((node) => ({ node, image: getComputedStyle(node).backgroundImage })).filter(({ image }) => /url\(/.test(image)).map(({ node, image }) => ({ tag: node.tagName, className: node.className?.toString() || '', image, box: box(node) })),
      accordionCandidates,
      faqs: [...main.querySelectorAll('details.e-n-accordion-item')].map((node) => ({
        open: node.open,
        question: cleanText(node.querySelector('summary')?.textContent),
        answer: cleanText([...node.children].filter((child) => child.tagName !== 'SUMMARY').map((child) => child.textContent).join(' ')),
        box: box(node),
      })),
      documentLinks,
      bodyText: cleanText(main.textContent),
    }
  })
}

const audit = { route, interactions: {} }

try {
  const page = await browser.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('BROWSER:', message.text())
  })

  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  await prepare(page)
  audit.desktop = await pageSnapshot(page)
  await page.screenshot({ path: path.join(outputDir, 'coa-library-desktop.png'), fullPage: true })

  const searchInputs = await page.$$('main input, #content input')
  audit.interactions.searches = []
  for (let index = 0; index < searchInputs.length; index += 1) {
    const input = searchInputs[index]
    if (!await input.isVisible()) continue
    const before = await page.evaluate(() => {
      const cleanText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
      const visible = (node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      return [...document.querySelectorAll('main h3,main h4,main h5,#content h3,#content h4,#content h5')].filter(visible).map((node) => cleanText(node.textContent))
    })
    await input.type(index % 2 === 0 ? 'BPC' : 'PHP')
    await new Promise((resolve) => setTimeout(resolve, 700))
    const after = await page.evaluate(() => {
      const cleanText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
      const visible = (node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      return {
        headings: [...document.querySelectorAll('main h3,main h4,main h5,#content h3,#content h4,#content h5')].filter(visible).map((node) => cleanText(node.textContent)),
        buttons: [...document.querySelectorAll('main button,#content button')].filter(visible).map((node) => cleanText(node.textContent)),
      }
    })
    audit.interactions.searches.push({ index, before, after })
    await input.click({ clickCount: 3 })
    await input.press('Backspace')
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  const likelyProductControls = await page.$$('main button, main [role="button"], #content button, #content [role="button"]')
  for (const candidate of likelyProductControls) {
    const label = clean(await candidate.evaluate((node) => node.textContent))
    if (/^(BPC-157|5-Amino-1MQ|Acetic Acid)$/i.test(label) && await candidate.isVisible()) {
      const beforeUrl = page.url()
      await candidate.click()
      await new Promise((resolve) => setTimeout(resolve, 700))
      audit.interactions.productOpen = {
        label,
        beforeUrl,
        afterUrl: page.url(),
        state: await page.evaluate(() => {
          const cleanText = (value) => value?.replace(/\s+/g, ' ').trim() || ''
          const visible = (node) => {
            const rect = node.getBoundingClientRect()
            const style = getComputedStyle(node)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
          }
          return {
            visibleLinks: [...document.querySelectorAll('main a[href],#content a[href]')].filter(visible).map((node) => ({ text: cleanText(node.textContent), href: node.href, target: node.target })),
            visibleButtons: [...document.querySelectorAll('main button,#content button')].filter(visible).map((node) => cleanText(node.textContent)),
          }
        }),
      }
      await page.screenshot({ path: path.join(outputDir, 'coa-library-product-open-desktop.png'), fullPage: false })
      break
    }
  }

  const faqDetails = await page.$$('main details.e-n-accordion-item, #content details.e-n-accordion-item')
  if (faqDetails.length > 1) {
    const before = await page.$$eval('main details.e-n-accordion-item, #content details.e-n-accordion-item', (nodes) => nodes.map((node) => node.open))
    const secondSummary = await faqDetails[1].$('summary')
    await secondSummary.click()
    await new Promise((resolve) => setTimeout(resolve, 500))
    const after = await page.$$eval('main details.e-n-accordion-item, #content details.e-n-accordion-item', (nodes) => nodes.map((node) => node.open))
    audit.interactions.faq = { before, after, exclusive: after.filter(Boolean).length === 1 }
    await page.screenshot({ path: path.join(outputDir, 'coa-library-faq-open-desktop.png'), fullPage: false })
  }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await prepare(page)
  audit.mobile = await pageSnapshot(page)
  await page.screenshot({ path: path.join(outputDir, 'coa-library-mobile.png'), fullPage: true })
  await page.close()
} finally {
  await browser.close()
}

await fs.writeFile(path.join(outputDir, 'coa-library-audit.json'), JSON.stringify(audit, null, 2))
console.log(JSON.stringify({
  route: audit.route,
  title: audit.desktop?.title,
  desktopDocument: audit.desktop?.document,
  desktopHeadings: audit.desktop?.headings.map(({ tag, text, box }) => ({ tag, text, box })),
  controls: audit.desktop?.controls.filter((item) => item.tag !== 'A' || /COA|SEARCH|BPC|Vial|Capsule|Liquid|Topical/i.test(item.text)).map(({ tag, type, text, placeholder, href, box }) => ({ tag, type, text, placeholder, href, box })),
  documentLinks: audit.desktop?.documentLinks,
  faqs: audit.desktop?.faqs,
  interactions: audit.interactions,
  mobileDocument: audit.mobile?.document,
  mobileHeadings: audit.mobile?.headings.map(({ tag, text, box }) => ({ tag, text, box })),
}, null, 2))
