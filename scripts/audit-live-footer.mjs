import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const referenceUrl = process.env.FOOTER_REFERENCE_URL || 'https://purehealthpeptides.com/'
const outputDir = path.resolve(
  import.meta.dirname,
  '..',
  'preview',
  process.env.FOOTER_AUDIT_DIR || 'footer-reference',
)

await fs.mkdir(outputDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const results = []

try {
  for (const viewport of [
    { label: 'desktop', width: 1440, height: 1000 },
    { label: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage()
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })
    await page.goto(referenceUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.mouse.move(40, 40)
    await new Promise((resolve) => setTimeout(resolve, 4_000))

    const visibleFooter = await page.$('footer')
    await visibleFooter.evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await new Promise((resolve) => setTimeout(resolve, 2_500))
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await new Promise((resolve) => setTimeout(resolve, 1_500))

    const audit = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const rect = (element) => {
        const box = element.getBoundingClientRect()
        return {
          x: Math.round(box.x),
          y: Math.round(box.y + scrollY),
          width: Math.round(box.width),
          height: Math.round(box.height),
        }
      }
      const style = (element) => {
        const computed = getComputedStyle(element)
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          backgroundImage: computed.backgroundImage,
          fontFamily: computed.fontFamily,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          lineHeight: computed.lineHeight,
          letterSpacing: computed.letterSpacing,
          fontStretch: computed.fontStretch,
          padding: computed.padding,
          margin: computed.margin,
          gap: computed.gap,
          borderTop: computed.borderTop,
          borderBottom: computed.borderBottom,
        }
      }

      const allFooters = [...document.querySelectorAll('footer')]
      const footer = allFooters.find(visible) || allFooters[0]
      if (!footer) throw new Error('No footer element found')
      footer.dataset.auditTarget = 'footer'

      const items = [...footer.querySelectorAll('img, h1, h2, h3, h4, h5, h6, a, p, button, summary')]
        .filter(visible)
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          className: element.className?.baseVal || element.className || '',
          text: (element.textContent || element.getAttribute('alt') || '').replace(/\s+/g, ' ').trim(),
          href: element.href || '',
          src: element.currentSrc || element.src || '',
          rect: rect(element),
          style: style(element),
        }))

      const directSections = [...footer.children].filter(visible).map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className,
        rect: rect(element),
        style: style(element),
      }))
      const structural = [...footer.querySelectorAll('div, section')]
        .filter(visible)
        .filter((element) => {
          const computed = getComputedStyle(element)
          return computed.backgroundImage !== 'none'
            || computed.backgroundColor !== 'rgba(0, 0, 0, 0)'
            || element.className.includes('footer-')
            || element.dataset.id === '1fafafb'
        })
        .map((element) => ({
          dataId: element.dataset.id || '',
          className: element.className,
          rect: rect(element),
          style: style(element),
        }))

      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentHeight: document.documentElement.scrollHeight,
        footer: { tag: footer.tagName.toLowerCase(), className: footer.className, rect: rect(footer), style: style(footer) },
        directSections,
        structural,
        items,
        text: footer.innerText.replace(/\n{3,}/g, '\n\n').trim(),
        images: [...footer.querySelectorAll('img')].filter(visible).map((image) => ({
          alt: image.alt,
          src: image.currentSrc || image.src,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          rect: rect(image),
        })),
      }
    })

    const footerHandle = await page.$('[data-audit-target="footer"]')
    await footerHandle.screenshot({ path: path.join(outputDir, `live-footer-${viewport.label}.png`) })
    await fs.writeFile(path.join(outputDir, `live-footer-${viewport.label}.html`), await footerHandle.evaluate((element) => element.outerHTML))
    results.push({ label: viewport.label, ...audit })
    await page.close()
  }

  await fs.writeFile(path.join(outputDir, 'audit.json'), JSON.stringify(results, null, 2))
  console.log(`Saved live footer audit to ${outputDir}`)
} finally {
  await browser.close()
}
