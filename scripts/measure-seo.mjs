import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import lighthouse from 'lighthouse'
import puppeteer from 'puppeteer-core'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { serveBuiltSite } from './serve-built-site.mjs'

const label = process.argv[2] || 'after'
const directory = process.argv[3] || 'dist'
const output = resolve('artifacts', `seo-${label}`)
await mkdir(output, { recursive: true })
const { server, url } = await serveBuiltSite({ directory })
const defaultRoutes = ['/', '/shipping-policy/', label.startsWith('before') ? '/product/n-acetyl-semx-amidate/' : '/product/n-acetyl-semax-amidate/', '/coa-library/', '/shop/', '/product/bpc-157/', '/product/bpc-157-tb-500/']
const routes = process.env.SEO_ROUTES?.split(',').map((route) => route.trim()).filter(Boolean) || defaultRoutes
const formFactors = process.env.SEO_FORM_FACTORS?.split(',').map((formFactor) => formFactor.trim()).filter(Boolean) || ['mobile', 'desktop']
const results = []
try {
  for (const formFactor of formFactors) {
    if (!['mobile', 'desktop'].includes(formFactor)) throw new Error(`Unsupported form factor: ${formFactor}`)
    for (const path of routes) {
      const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--remote-debugging-port=0'] })
      try {
        const endpoint = new URL(browser.wsEndpoint())
        const page = await browser.newPage()
        await page.goto(`${url}${path}`, { waitUntil: 'networkidle0' })
        const links = await page.$$eval('a[href]', (nodes) => nodes.map((node) => ({
          destination: node.getAttribute('href'), visibleText: node.innerText.trim(), accessibleName: node.getAttribute('aria-label') || node.innerText.trim() || node.querySelector('img')?.alt || '',
        })))
        const { lhr } = await lighthouse(`${url}${path}`, { port: Number(endpoint.port), logLevel: 'error', onlyCategories: ['performance', 'seo', 'accessibility'], output: 'json' }, formFactor === 'desktop' ? desktopConfig : undefined)
        const name = `${formFactor}-${path.replaceAll('/', '_') || 'home'}`
        await writeFile(resolve(output, `${name}.json`), JSON.stringify(lhr, null, 2))
        const row = { compression: process.env.SEO_COMPRESSION === '1' ? 'gzip' : 'none', path, formFactor, timestamp: lhr.fetchTime, lighthouseVersion: lhr.lighthouseVersion, performance: lhr.categories.performance.score, seo: lhr.categories.seo.score, accessibility: lhr.categories.accessibility.score, lcpMs: lhr.audits['largest-contentful-paint'].numericValue, cls: lhr.audits['cumulative-layout-shift'].numericValue, tbtMs: lhr.audits['total-blocking-time'].numericValue, linkAudit: lhr.audits['link-text'], links }
        results.push(row)
        await writeFile(resolve(output, 'summary.json'), JSON.stringify(results, null, 2))
        console.log(`${label} ${formFactor} ${path}: performance ${row.performance}, LCP ${Math.round(row.lcpMs)}ms, link audit ${row.linkAudit.score}`)
      } finally { await browser.close() }
    }
  }
} finally { await new Promise((done) => server.close(done)) }
