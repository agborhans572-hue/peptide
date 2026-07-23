import { readFileSync } from 'node:fs'
const catalog = JSON.parse(readFileSync(new URL('../catalog/catalog.generated.json', import.meta.url), 'utf8'))
const shopProducts = catalog.products

export const SITE_ORIGIN = 'https://purehealthpeptides.com'

const productDetails = JSON.parse(
  readFileSync(new URL('../src/productDetailData.json', import.meta.url), 'utf8'),
)
const productImages = JSON.parse(
  readFileSync(new URL('../src/productImageManifest.json', import.meta.url), 'utf8'),
)

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function plainText(html) {
  return decodeEntities(String(html || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function metaDescription(html, fallback) {
  const text = plainText(html) || fallback
  if (text.length <= 160) return text
  return `${text.slice(0, 156).replace(/\s+\S*$/, '')}…`
}

const FORMAT_META = {
  vials: { title: 'Research Vial', description: 'research vial' },
  capsules: { title: 'Research Capsules', description: 'research capsules' },
  liquids: { title: 'Research Liquid', description: 'research liquid' },
  topicals: { title: 'Research Topical', description: 'research topical system' },
}

const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`
const WEBSITE_ID = `${SITE_ORIGIN}/#website`

function absoluteUrl(path) {
  return new URL(path, SITE_ORIGIN).href
}

function productTitle(product) {
  const format = FORMAT_META[product.type]?.title || 'Research Material'
  const suffix = ` ${format} | Batch COA`
  const maximumLength = 64
  if (`${product.name}${suffix}`.length <= maximumLength) return `${product.name}${suffix}`
  const available = Math.max(16, maximumLength - suffix.length - 1)
  return `${product.name.slice(0, available).trim()}…${suffix}`
}

function productDescription(product) {
  const format = FORMAT_META[product.type]?.description || 'research material'
  const source = product.shortDescription || product.description
  return metaDescription(`${product.name} ${format}. ${source}`, `${product.name} ${format} for controlled in vitro laboratory research. Research use only.`)
}

function breadcrumbSchema(route, product) {
  if (route.path === '/') return null
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` }]
  if (product) {
    items.push({ '@type': 'ListItem', position: 2, name: 'Research Peptides', item: `${SITE_ORIGIN}/shop/` })
    items.push({ '@type': 'ListItem', position: 3, name: product.name, item: absoluteUrl(route.path) })
  } else {
    items.push({ '@type': 'ListItem', position: 2, name: route.breadcrumb || route.title.split('|')[0].trim(), item: absoluteUrl(route.path) })
  }
  return { '@type': 'BreadcrumbList', '@id': `${absoluteUrl(route.path)}#breadcrumb`, itemListElement: items }
}

function baseSchemaGraph(route) {
  const pageUrl = absoluteUrl(route.path)
  return [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'Pure Health Peptides',
      url: `${SITE_ORIGIN}/`,
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/assets/logo.svg` },
      email: 'info@purehealthpeptides.com',
      description: 'Supplier of independently batch-tested materials for controlled in vitro laboratory research.',
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: `${SITE_ORIGIN}/`,
      name: 'Pure Health Peptides',
      publisher: { '@id': ORGANIZATION_ID },
      inLanguage: 'en-US',
    },
    {
      '@type': route.path === '/shop/' || route.path.startsWith('/coa-library/') ? 'CollectionPage' : 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: route.title,
      description: route.description,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
      primaryImageOfPage: { '@type': 'ImageObject', url: route.image },
      inLanguage: 'en-US',
    },
  ]
}

function staticSchema(route) {
  const graph = baseSchemaGraph(route)
  const breadcrumb = breadcrumbSchema(route)
  if (breadcrumb) graph.push(breadcrumb)

  if (route.path === '/shop/') {
    graph.push({
      '@type': 'ItemList',
      '@id': `${SITE_ORIGIN}/shop/#catalog`,
      name: 'Research Peptides and Laboratory Materials',
      numberOfItems: shopProducts.length,
      itemListElement: [...shopProducts]
        .sort((left, right) => right.popularity - left.popularity)
        .slice(0, 24)
        .map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: product.name,
          url: new URL(product.productUrl, SITE_ORIGIN).href,
        })),
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}

function productSchema(route, product) {
  const graph = baseSchemaGraph(route)
  const offers = product.options.map((option) => ({
    '@type': 'Offer',
    sku: option.sku,
    name: `${product.name} — ${option.label}`,
    url: absoluteUrl(route.path),
    priceCurrency: 'USD',
    price: (option.priceCents / 100).toFixed(2),
    availability: option.available && option.stockQuantity !== 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': ORGANIZATION_ID },
  }))

  graph.push({
    '@type': 'Product',
    '@id': `${absoluteUrl(route.path)}#product`,
    name: product.name,
    description: route.description,
    image: [route.image],
    sku: product.sku,
    brand: { '@type': 'Brand', name: 'Pure Health Peptides' },
    category: `${FORMAT_META[product.type]?.title || 'Research Material'} — laboratory research use only`,
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Intended use', value: 'Controlled in vitro laboratory research only' },
      { '@type': 'PropertyValue', name: 'Testing', value: 'Independent third-party batch testing with Certificate of Analysis' },
    ],
    offers: offers.length === 1 ? offers[0] : offers,
  })
  graph.push(breadcrumbSchema(route, product))
  return { '@context': 'https://schema.org', '@graph': graph }
}

const staticRoutes = [
  {
    path: '/',
    title: 'Research Peptides for Laboratory Use | Pure Health Peptides',
    description: 'Shop high-purity research peptides for controlled in vitro laboratory use. Every batch is independently tested in the USA with a searchable COA.',
    breadcrumb: 'Home',
  },
  {
    path: '/shop/',
    title: 'Research Peptides for Sale | COA-Verified USA Catalog',
    description: 'Browse 115 research peptides and laboratory materials with third-party batch testing, searchable Certificates of Analysis, and fast U.S. shipping.',
    breadcrumb: 'Research Peptides',
  },
  {
    path: '/about-us/',
    title: 'About Our Research Peptide Quality Standards | PHP',
    description: 'Learn how Pure Health Peptides supports qualified laboratories with independent batch testing, traceable COAs, and research-use-only compliance.',
    breadcrumb: 'About Us',
  },
  {
    path: '/research-areas/',
    title: 'Laboratory Peptide Research Areas | In Vitro Catalog',
    description: 'Explore research peptides and laboratory materials by analytical area, including cellular energy, peptide stability, signaling, and molecular interactions.',
    breadcrumb: 'Research Areas',
  },
  {
    path: '/news/',
    title: 'Recent News | Pure Health Peptides',
    description: 'Read recent Pure Health Peptides research, product, testing, and manufacturing updates.',
  },
  {
    path: '/pure-elite-access/',
    title: 'Pure Elite Access | Pure Health Peptides',
    description: 'Explore Pure Elite Access rewards, member tiers, and research catalog benefits.',
  },
  {
    path: '/my-account/',
    title: 'My Account | Pure Health Peptides',
    description: 'Securely access your Pure Health Peptides profile, address, orders, and account settings.',
    indexable: false,
  },
  {
    path: '/auth/callback/',
    title: 'Verifying Account | Pure Health Peptides',
    description: 'Complete a secure Pure Health Peptides account verification or sign-in.',
    indexable: false,
  },
  {
    path: '/auth/reset-password/',
    title: 'Reset Password | Pure Health Peptides',
    description: 'Complete a secure Pure Health Peptides customer password reset.',
    indexable: false,
  },
  {
    path: '/auth/error/',
    title: 'Account Link Error | Pure Health Peptides',
    description: 'Request a new Pure Health Peptides account verification or recovery link.',
    indexable: false,
  },
  {
    path: '/track-my-order/',
    title: 'Track My Order | Pure Health Peptides',
    description: 'Open the Pure Health Peptides order tracking area.',
    indexable: false,
  },
  {
    path: '/checkout/',
    title: 'Checkout | Pure Health Peptides',
    description: 'Complete a Pure Health Peptides research product checkout.',
    indexable: false,
  },
  {
    path: '/order-confirmation/',
    title: 'Order Confirmation | Pure Health Peptides',
    description: 'Review the status and summary of a Pure Health Peptides order.',
    indexable: false,
  },
  {
    path: '/faqs/',
    title: 'Research Peptide FAQs | Testing, COAs, Shipping & Storage',
    description: 'Get answers about research peptide batch testing, Certificates of Analysis, product storage, U.S. shipping, ordering, and research-use requirements.',
    breadcrumb: 'Research Peptide FAQs',
  },
  {
    path: '/contact-us/',
    title: 'Contact Us | Pure Health Peptides Support',
    description: 'Contact Pure Health Peptides support for catalog, order, shipping, or research documentation questions.',
  },
  {
    path: '/shipping-policy/',
    title: 'Shipping Policy | Pure Health Peptides',
    description: 'Review Pure Health Peptides shipping service areas, rates, timing, tracking, and damaged-shipment procedures.',
  },
  {
    path: '/refund-policy/',
    title: 'Refund Policy | Pure Health Peptides',
    description: 'Review Pure Health Peptides cancellation, return authorization, damage claim, and refund procedures.',
  },
  {
    path: '/privacy-policy/',
    title: 'Privacy Policy | Pure Health Peptides',
    description: 'Learn how Pure Health Peptides collects, uses, protects, and retains customer and transaction information.',
  },
  {
    path: '/terms-and-conditions/',
    title: 'Terms and Conditions | Pure Health Peptides',
    description: 'Review the purchasing, research-use, site-content, and customer responsibility terms for Pure Health Peptides.',
  },
  {
    path: '/info-cards/',
    title: 'Research Peptide Product Information Cards | PHP',
    description: 'Browse downloadable research peptide information cards with compound identity, molecular details, storage guidance, and laboratory-use references.',
    breadcrumb: 'Product Information Cards',
  },
  {
    path: '/coa-process/',
    title: 'How Research Peptide COA Testing Works | PHP',
    description: 'Learn how third-party HPLC and analytical testing verify research peptide identity, purity, quantity, and batch quality through a Certificate of Analysis.',
    breadcrumb: 'COA Testing Process',
  },
  {
    path: '/manufacturing/',
    title: 'Research Peptide Quality & Manufacturing Standards | PHP',
    description: 'Review sourcing, handling, batch documentation, and independent quality-control standards for Pure Health Peptides laboratory research materials.',
    breadcrumb: 'Quality & Manufacturing',
  },
  {
    path: '/dilution-guide/',
    title: 'Laboratory Peptide Dilution Guide | Research Reference',
    description: 'Use the laboratory peptide dilution guide and downloadable reference materials for controlled in vitro research preparation and concentration planning.',
    breadcrumb: 'Laboratory Dilution Guide',
  },
  {
    path: '/coa-library/',
    title: 'Research Peptide COA Library | Batch Test Results',
    description: 'Search batch-specific research peptide Certificates of Analysis by product format, compound, and lot to verify identity, purity, quantity, and quality results.',
    breadcrumb: 'COA Library',
  },
  {
    path: '/coa-library/vials/',
    title: 'Research Peptide Vial COAs | Batch Certificates',
    description: 'Browse batch-specific Certificates of Analysis for research peptide vials, including independent identity, purity, quantity, and quality test documentation.',
    breadcrumb: 'Vial COAs',
  },
  {
    path: '/coa-library/capsules/',
    title: 'Research Capsule COAs | Batch Certificates',
    description: 'Browse batch-specific Certificates of Analysis for research capsules with independent identity, assay, quantity, and quality testing documentation.',
    breadcrumb: 'Capsule COAs',
  },
  {
    path: '/coa-library/liquids/',
    title: 'Research Liquid COAs | Batch Certificates',
    description: 'Browse batch-specific Certificates of Analysis for liquid research materials with independent identity, assay, quantity, and quality documentation.',
    breadcrumb: 'Liquid COAs',
  },
  {
    path: '/coa-library/topicals/',
    title: 'Research Topical COAs | Batch Certificates',
    description: 'Browse batch-specific Certificates of Analysis for topical research systems with independent identity, assay, quantity, and quality documentation.',
    breadcrumb: 'Topical COAs',
  },
]

const productRoutes = shopProducts.map((product) => {
  const productUrl = new URL(product.productUrl, SITE_ORIGIN)
  const slug = productUrl.pathname.split('/').filter(Boolean).at(-1)
  const detail = productDetails[product.detailKey || slug]
  const image = detail?.images?.find((item) => item.role === 'primary')?.src || product.image
  const socialImage = productImages.social[product.slug]
  const route = {
    path: productUrl.pathname,
    title: productTitle(product),
    description: productDescription(product),
    image: absoluteUrl(socialImage?.src || image),
    imageAlt: product.imageAlt || `${product.name} ${FORMAT_META[product.type]?.description || 'research material'}`,
    imageWidth: socialImage?.width,
    imageHeight: socialImage?.height,
    imageType: socialImage?.type,
    kind: 'product',
    indexable: true,
    lastmod: product.date,
  }

  return {
    ...route,
    schema: productSchema(route, product),
  }
})

const pageImages = {
  '/coa-library/': '/assets/coa-documents.png',
  '/coa-library/vials/': '/assets/coa-documents.png',
  '/coa-library/capsules/': '/assets/coa-documents.png',
  '/coa-library/liquids/': '/assets/coa-documents.png',
  '/coa-library/topicals/': '/assets/coa-documents.png',
  '/coa-process/': '/assets/peptide-info/coa-lab.png',
  '/manufacturing/': '/assets/about/news-manufacturing.png',
  '/about-us/': '/assets/about/about-bg.jpg',
}

const enrichedStaticRoutes = staticRoutes.map((route) => {
  const image = absoluteUrl(pageImages[route.path] || '/assets/hero-vials.png')
  const enriched = {
    ...route,
    image,
    imageAlt: route.path.startsWith('/coa-') || route.path === '/coa-library/'
      ? 'Research peptide Certificate of Analysis documentation'
      : 'Pure Health Peptides laboratory research materials',
  }
  return { ...enriched, schema: staticSchema(enriched) }
})

export const productionRoutes = [...enrichedStaticRoutes, ...productRoutes].map((route) => ({
  kind: 'page',
  indexable: true,
  ...route,
}))
