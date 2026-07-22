import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const baseUrl = process.env.FOOTER_QA_URL || 'http://127.0.0.1:4173'
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const outputDir = path.resolve(import.meta.dirname, '..', 'preview', 'footer-qa')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

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
    await page.evaluateOnNewDocument(() => localStorage.setItem('php-research-confirmed', 'true'))
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0', timeout: 30_000 })
    await page.$eval('.site-footer', (footer) => footer.scrollIntoView({ block: 'start' }))

    const metrics = await page.evaluate(() => {
      const footer = document.querySelector('.site-footer')
      const desktopNavigation = document.querySelector('.footer-navigation-desktop')
      const mobileNavigation = document.querySelector('.footer-navigation-mobile')
      const rect = footer.getBoundingClientRect()
      const style = getComputedStyle(footer)
      const visible = (element) => getComputedStyle(element).display !== 'none'
      return {
        footer: { width: Math.round(rect.width), height: Math.round(rect.height) },
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        backgroundImage: style.backgroundImage,
        desktopNavigationVisible: visible(desktopNavigation),
        mobileNavigationVisible: visible(mobileNavigation),
        desktopColumns: desktopNavigation.children.length,
        mobileDirectRows: mobileNavigation.querySelectorAll('.footer-mobile-direct').length,
        mobileAccordions: mobileNavigation.querySelectorAll('details').length,
        disclaimerFontSize: getComputedStyle(document.querySelector('.footer-disclaimer p')).fontSize,
        navigationFontSize: getComputedStyle(document.querySelector('.footer-column-heading')).fontSize,
        text: footer.innerText,
        brokenImages: [...footer.querySelectorAll('img')]
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.src),
      }
    })

    assert(metrics.footer.width === viewport.width, `${viewport.label}: footer does not span viewport`)
    assert(metrics.overflow <= 1, `${viewport.label}: horizontal overflow is ${metrics.overflow}px`)
    assert(metrics.backgroundImage.includes('footer-bg.png'), `${viewport.label}: footer background asset missing`)
    assert(metrics.desktopColumns === 3, `${viewport.label}: expected three desktop columns`)
    assert(metrics.mobileDirectRows === 2, `${viewport.label}: expected two direct mobile rows`)
    assert(metrics.mobileAccordions === 4, `${viewport.label}: expected four mobile accordions`)
    assert(metrics.disclaimerFontSize === '14px', `${viewport.label}: disclaimer typography changed`)
    assert(metrics.navigationFontSize === '16px', `${viewport.label}: navigation typography changed`)
    assert(metrics.text.includes('FDA Disclaimer:'), `${viewport.label}: FDA disclaimer missing`)
    assert(metrics.text.includes('Mon-Fri / Except Holidays'), `${viewport.label}: shipping days missing`)
    assert(metrics.brokenImages.length === 0, `${viewport.label}: broken footer image(s): ${metrics.brokenImages.join(', ')}`)

    if (viewport.label === 'desktop') {
      assert(metrics.desktopNavigationVisible, 'desktop: navigation columns are hidden')
      assert(!metrics.mobileNavigationVisible, 'desktop: duplicate mobile navigation is visible')
      assert(metrics.footer.height >= 1375 && metrics.footer.height <= 1383, `desktop: unexpected footer height ${metrics.footer.height}px`)
    } else {
      assert(!metrics.desktopNavigationVisible, 'mobile: duplicate desktop navigation is visible')
      assert(metrics.mobileNavigationVisible, 'mobile: mobile navigation is hidden')
      assert(metrics.footer.height >= 1549 && metrics.footer.height <= 1557, `mobile: unexpected collapsed footer height ${metrics.footer.height}px`)
      const details = await page.$('.footer-mobile-accordion')
      await details.$eval('summary', (summary) => summary.click())
      assert(await details.evaluate((element) => element.open), 'mobile: footer accordion did not open')
      assert(await details.$eval('.footer-mobile-accordion-links', (links) => links.getBoundingClientRect().height > 0), 'mobile: expanded links are not visible')
      await details.$eval('summary', (summary) => summary.click())
    }

    const footer = await page.$('.site-footer')
    await footer.screenshot({ path: path.join(outputDir, `footer-home-${viewport.label}.png`) })
    results.push({ viewport: viewport.label, ...metrics })
    await page.close()
  }

  const navigationPage = await browser.newPage()
  await navigationPage.setViewport({ width: 1440, height: 900 })
  await navigationPage.evaluateOnNewDocument(() => localStorage.setItem('php-research-confirmed', 'true'))
  await navigationPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' })
  await navigationPage.click('.footer-navigation-desktop a[href="/about-us/"]')
  await navigationPage.waitForFunction(() => location.pathname === '/about-us/')
  assert(await navigationPage.evaluate(() => location.pathname) === '/about-us/', 'footer SPA navigation failed')
  await navigationPage.close()

  await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify(results, null, 2))
  console.log('Footer QA passed (desktop, mobile, accordion, images, and SPA navigation).')
} finally {
  await browser.close()
}
