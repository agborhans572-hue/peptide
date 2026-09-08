import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { productionRoutes } from './site-routes.mjs'

// Render the same public React components at build time; no browser, customer state, or network requests.
export async function prerenderPages() {
  const server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  const output = new Map()
  try {
    const load = (name) => server.ssrLoadModule(`/src/${name}.jsx`)
    const [home, about, support, info, coa, policy, shop, product] = await Promise.all([
      load('HomePage'), load('AboutPages'), load('SupportPages'), load('PeptideInfoPages'), load('CoaLibraryPages'), load('PolicyPages'), load('ShopPage'), load('ProductDetailPage'),
    ])
    const chrome = await load('App')
    const noop = () => {}
    const header = renderToStaticMarkup(createElement(chrome.Header, { onMenu: noop, onSearch: noop, onCart: noop, onHome: noop, onShop: noop, onNavigate: noop, cartCount: 0 }))
    const footer = renderToStaticMarkup(createElement(chrome.Footer, { onNavigate: noop }))
    const documents = JSON.parse(await readFile('src/productDocumentManifest.json', 'utf8'))
    const coaSource = JSON.parse(await readFile('src/coaLibraryData.json', 'utf8'))
    const pages = {
      '/': [home.default], '/shop/': [shop.default], '/about-us/': [about.AboutPage], '/research-areas/': [about.ResearchAreasPage], '/news/': [about.NewsPage], '/pure-elite-access/': [about.ElitePage],
      '/faqs/': [support.FaqPage], '/contact-us/': [support.ContactPage], '/info-cards/': [info.ProductInfoPage], '/coa-process/': [info.CoaProcessPage], '/manufacturing/': [info.ManufacturingPage], '/dilution-guide/': [info.DilutionGuidePage], '/coa-library/': [coa.CoaLibraryPage],
      '/shipping-policy/': [policy.default, { type: 'shipping' }], '/refund-policy/': [policy.default, { type: 'refunds' }], '/privacy-policy/': [policy.default, { type: 'privacy' }], '/terms-and-conditions/': [policy.default, { type: 'terms' }],
    }
    for (const [category, source] of Object.entries(coaSource)) {
      const initialIndex = { heading: source.heading, items: source.items.map((item, index) => ({ id: `${category}-${index + 1}`, product: item.product, batchCount: item.batches.length, batchIds: item.batches.map((batch) => batch.id) })) }
      pages[`/coa-library/${category}/`] = [coa.CoaCategoryPage, { category, initialIndex }]
    }
    output.set('chrome', { header, footer })
    for (const route of productionRoutes.filter((item) => item.indexable)) {
      let component, props, document
      if (route.kind === 'product') {
        document = JSON.parse(await readFile(`public${documents[route.product.slug].url}`, 'utf8'))
        component = product.ProductDetailPage
        props = { product: route.product, detail: document.detail }
      } else [component, props = {}] = pages[route.path] || []
      if (!component) throw new Error(`Missing public renderer for ${route.path}`)
      const noop = () => {}
      let html = renderToStaticMarkup(createElement(component, { onShop: noop, onNavigate: noop, onAddToCart: noop, onProduct: noop, onLearnMore: noop, ...props }))
      if (['/', '/about-us/', '/news/', '/pure-elite-access/', '/contact-us/', '/coa-process/', '/manufacturing/', '/coa-library/'].includes(route.path) || route.product?.type === 'topicals') html += renderToStaticMarkup(createElement(chrome.Newsletter))
      html = html.replace(/<form\b/g, '<noscript><p>Enable JavaScript to use this form.</p></noscript><form inert="" aria-disabled="true"')
      output.set(route.path, { html, document })
    }
    return output
  } finally { await server.close() }
}
