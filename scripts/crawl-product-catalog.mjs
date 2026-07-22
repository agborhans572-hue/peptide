import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { shopProducts } from '../src/shopData.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_DIR = path.join(ROOT, 'preview', 'reference-product-catalog')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'product-catalog-audit.json')
const BASE = 'https://purehealthpeptides.com'
const STORE_API = `${BASE}/wp-json/wc/store/v1/products`
const WP_PRODUCT_API = `${BASE}/wp-json/wp/v2/product`
const SHOP_URL = `${BASE}/shop/`

const htmlEntities = {
  amp: '&',
  apos: "'",
  '#039': "'",
  '#39': "'",
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  '#036': '$',
}

function decodeHtml(value = '') {
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z\d]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase()
    if (htmlEntities[lower] != null) return htmlEntities[lower]
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16))
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10))
    return match
  })
}

function stripHtml(value = '') {
  return decodeHtml(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<\/li\s*>/gi, '\n')
      .replace(/<\/h[1-6]\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cleanDescriptionHtml(value = '') {
  return String(value)
    .replace(/\r/g, '')
    .replace(/\s*<div class="molecular-structure-controls">[\s\S]*?<div class="molecular-structure-img-wrap">/i, '\n<div class="molecular-structure-img-wrap">')
    .replace(/\s+decoding="[^"]*"/gi, '')
    .replace(/\s+loading="[^"]*"/gi, '')
    .replace(/\s+fetchpriority="[^"]*"/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractHeadings(html = '') {
  return [...String(html).matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => stripHtml(match[2]).replace(/:\s*$/, '').trim())
    .filter(Boolean)
}

function extractResearchInfo(html = '') {
  const headingPattern = /<h([1-6])\b[^>]*>[\s\S]*?(Research Applications?|Research Areas?|Research Use|Research Focus)[\s\S]*?<\/h\1>/i
  const match = headingPattern.exec(html)
  if (!match) return []
  const remainder = html.slice(match.index + match[0].length)
  const section = remainder.split(/<h[1-6]\b/i)[0]
  const items = [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => stripHtml(item[1]))
  return items.length ? items : stripHtml(section).split('\n').filter(Boolean)
}

function extractFaqs(html = '', wpMeta = {}) {
  const pairs = []
  const add = (question, answer) => {
    const normalizedQuestion = stripHtml(question)
    const normalizedAnswer = stripHtml(answer)
    if (!normalizedQuestion || !normalizedAnswer) return
    if (!pairs.some((pair) => pair.question === normalizedQuestion)) pairs.push({ question: normalizedQuestion, answer: normalizedAnswer })
  }

  const graph = wpMeta?.yoast_head_json?.schema?.['@graph'] || []
  for (const node of graph) {
    const types = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']]
    if (!types.includes('FAQPage') && !node?.mainEntity) continue
    const entities = Array.isArray(node.mainEntity) ? node.mainEntity : [node.mainEntity]
    for (const entity of entities.filter(Boolean)) add(entity.name, entity.acceptedAnswer?.text)
  }

  for (const details of String(html).matchAll(/<details\b[^>]*>[\s\S]*?<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi)) {
    add(details[1], details[2])
  }

  const headingPattern = /<h([1-6])\b[^>]*>([\s\S]*?\?)[\s\S]*?<\/h\1>/gi
  const headings = [...String(html).matchAll(headingPattern)]
  for (let index = 0; index < headings.length; index += 1) {
    const current = headings[index]
    const afterHeading = current.index + current[0].length
    const nextHeadingIndex = String(html).slice(afterHeading).search(/<h[1-6]\b/i)
    const answerHtml = nextHeadingIndex < 0 ? String(html).slice(afterHeading) : String(html).slice(afterHeading, afterHeading + nextHeadingIndex)
    add(current[2], answerHtml)
  }

  return pairs
}

function extractMolecularImage(html = '') {
  const match = String(html).match(/<img\b[^>]*class="[^"]*molecular-structure-img[^"]*"[^>]*>|<img\b[^>]*src="([^"]+)"[^>]*class="[^"]*molecular-structure-img[^"]*"[^>]*>/i)
  if (!match) return null
  return match[0].match(/\bsrc="([^"]+)"/i)?.[1] || null
}

function normalizeUrl(value = '') {
  try {
    const url = new URL(value, BASE)
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}/`
  } catch {
    return value
  }
}

function productType(product, localProduct) {
  if (localProduct?.type) return localProduct.type
  const formClass = product.class_list?.find((className) => className.startsWith('product-form-'))
  return formClass?.replace('product-form-', '') || 'unknown'
}

function roleForImage(image, index, mainImage) {
  const signal = `${image.name || ''} ${image.alt || ''} ${image.src || ''}`.toLowerCase()
  if (index === 0 || image.src === mainImage) return 'primary'
  if (/\bcard\b|info[-_ ]?card/.test(signal)) return 'info-card'
  if (/\bcoa\b|certificate|evergreen|ethos|janoshik|lot[-_ ]|batch[-_ ]/.test(signal)) return 'coa'
  if (/signature|molecular|structure/.test(signal)) return 'molecular-structure'
  return 'gallery'
}

function centsToNumber(value, minorUnit = 2) {
  const number = Number(value)
  return Number.isFinite(number) ? number / 10 ** minorUnit : null
}

function roundMoney(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
      'user-agent': 'PureHealthPeptidesRebuildAudit/1.0',
    },
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`)
  return response.text()
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url))
}

function productFormsFromShop(html) {
  const byId = new Map()
  const formPattern = /<form\b[^>]*class="[^"]*variations_form\s+cart[^"]*"[^>]*data-product_id="(\d+)"[^>]*data-product_variations="([^"]*)"[^>]*>([\s\S]*?)<\/form>/gi
  for (const match of html.matchAll(formPattern)) {
    const id = Number(match[1])
    if (byId.has(id)) continue
    try {
      const selects = {}
      for (const selectMatch of match[3].matchAll(/<select\b[^>]*name="attribute_([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi)) {
        const attribute = decodeHtml(selectMatch[1])
        const options = [...selectMatch[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((optionMatch) => ({
          value: decodeHtml(optionMatch[1].match(/\bvalue="([^"]*)"/i)?.[1] || stripHtml(optionMatch[2])),
          selected: /\bselected(?:="selected")?/i.test(optionMatch[1]),
        }))
        selects[attribute] = {
          options: options.map((option) => option.value),
          selected: options.find((option) => option.selected)?.value || options[0]?.value || null,
        }
      }
      const displayedPrice = match[3].match(/class="[^"]*product-price-display[^"]*"[^>]*data-baseSalePrice="([^"]+)"/i)?.[1]
      byId.set(id, {
        variations: JSON.parse(decodeHtml(match[2])),
        selects,
        displayedPrice: Number.isFinite(Number(displayedPrice)) ? Number(displayedPrice) : null,
      })
    } catch (error) {
      byId.set(id, { variations: [], selects: {}, displayedPrice: null, parseError: error.message, sourceLength: match[2].length })
    }
  }
  return byId
}

function compactVariations(product, productForm) {
  const rawVariations = productForm?.variations
  if (!Array.isArray(rawVariations)) return []
  const compact = rawVariations.map((variation) => {
    const attributes = Object.fromEntries(
      Object.entries(variation.attributes || {}).map(([key, value]) => [key.replace(/^attribute_/, ''), decodeHtml(value)]),
    )
    return {
      id: variation.variation_id,
      label: Object.values(attributes).filter(Boolean).join(' / '),
      attributes,
      price: roundMoney(Number(variation.display_price)),
      regularPrice: roundMoney(Number(variation.display_regular_price)),
      available: Boolean(variation.variation_is_active && variation.is_in_stock),
      stockQuantity: Number.isFinite(Number(variation.max_qty)) ? Number(variation.max_qty) : null,
      image: variation.image?.url || variation.image?.full_src || variation.image?.src || null,
    }
  })
  const selectOrder = Object.values(productForm?.selects || {})[0]?.options || []
  return compact.sort((a, b) => {
    const indexA = selectOrder.indexOf(a.label)
    const indexB = selectOrder.indexOf(b.label)
    return (indexA < 0 ? 9999 : indexA) - (indexB < 0 ? 9999 : indexB)
  })
}

function arraysEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function localDiffs(localProduct, remote, variations) {
  if (!localProduct) return ['missing-local-product']
  const diffs = []
  if (localProduct.name !== decodeHtml(remote.name)) diffs.push(`title: ${JSON.stringify(localProduct.name)} -> ${JSON.stringify(decodeHtml(remote.name))}`)
  const remoteCategories = remote.categories.map((category) => category.slug).sort()
  const localCategories = [...(localProduct.categories || [])].sort()
  if (!arraysEqual(localCategories, remoteCategories)) diffs.push(`categories: ${localCategories.join(',')} -> ${remoteCategories.join(',')}`)
  const remoteOptions = variations.map((variation) => ({
    label: variation.label,
    price: variation.price,
    available: variation.available,
  }))
  const localOptions = (localProduct.options || []).map((option) => ({
    label: decodeHtml(option.label),
    price: roundMoney(Number(option.price)),
    available: Boolean(option.available),
  }))
  if (!arraysEqual(localOptions, remoteOptions)) diffs.push('variant-label/price/availability')
  return diffs
}

function localStockDrift(localProduct, variations) {
  if (!localProduct) return []
  return variations.flatMap((variation) => {
    const localOption = (localProduct.options || []).find((option) => decodeHtml(option.label) === variation.label)
    if (!localOption || Number(localOption.maxQty) === Number(variation.stockQuantity)) return []
    return [{ label: variation.label, local: Number(localOption.maxQty), live: variation.stockQuantity }]
  })
}

function classifyDescription(headings, descriptionHtml, shortDescriptionHtml) {
  const normalized = headings.map((heading) => heading.toLowerCase())
  if (!stripHtml(descriptionHtml)) return stripHtml(shortDescriptionHtml) ? 'short-description-only' : 'no-description'
  const modernSignals = ['product name', 'product description', 'research applications', 'storage and handling', 'product specifications', 'compliance notice']
  if (modernSignals.filter((signal) => normalized.includes(signal)).length >= 4) return 'modern-structured'
  if (normalized.some((heading) => heading.includes('configuration')) || /modular peptide system/i.test(descriptionHtml)) return 'topical-modular'
  if (headings.length >= 3) return 'legacy-structured'
  if (headings.length > 0) return 'lightly-structured'
  return 'narrative'
}

const [pageOne, pageTwo, wpPageOne, wpPageTwo, shopHtml] = await Promise.all([
  fetchJson(`${STORE_API}?per_page=100&page=1`),
  fetchJson(`${STORE_API}?per_page=100&page=2`),
  fetchJson(`${WP_PRODUCT_API}?per_page=100&page=1&_fields=id,slug,date,modified,yoast_head_json`),
  fetchJson(`${WP_PRODUCT_API}?per_page=100&page=2&_fields=id,slug,date,modified,yoast_head_json`),
  fetchText(SHOP_URL),
])

const liveProducts = [...pageOne, ...pageTwo]
const wpById = new Map([...wpPageOne, ...wpPageTwo].map((product) => [product.id, product]))
const localByUrl = new Map(shopProducts.map((product) => [normalizeUrl(product.productUrl), product]))
const productFormsById = productFormsFromShop(shopHtml)

const products = liveProducts.map((product) => {
  const url = normalizeUrl(product.permalink)
  const localProduct = localByUrl.get(url)
  const type = productType(product, localProduct)
  const minorUnit = product.prices?.currency_minor_unit ?? 2
  const mainImage = product.images?.[0]?.src || null
  const dedupedImages = [...new Map((product.images || []).map((image) => [image.src, image])).values()]
  const descriptionHtml = cleanDescriptionHtml(product.description || '')
  const shortDescriptionHtml = String(product.short_description || '').trim()
  const wpMeta = wpById.get(product.id) || {}
  const headings = extractHeadings(descriptionHtml)
  const productForm = productFormsById.get(product.id)
  const variants = compactVariations(product, productForm)
  const defaultVariantLabel = Object.values(productForm?.selects || {})[0]?.selected || variants[0]?.label || null
  const defaultVariantIndex = Math.max(0, variants.findIndex((variant) => variant.label === defaultVariantLabel))
  const variationPrices = variants.map((variation) => variation.price).filter(Number.isFinite)
  const storePrice = centsToNumber(product.prices?.price, minorUnit)
  const allPrices = variationPrices.length ? variationPrices : [storePrice].filter(Number.isFinite)
  const diffs = localDiffs(localProduct, product, variants)
  const stockDrift = localStockDrift(localProduct, variants)

  return {
    id: product.id,
    slug: product.slug,
    url,
    title: decodeHtml(product.name),
    documentTitle: decodeHtml(wpMeta.yoast_head_json?.title || `${product.name} - Pure Health Peptides`),
    type,
    categories: (product.categories || []).map((category) => ({ slug: category.slug, name: decodeHtml(category.name).trim() })),
    tags: (product.tags || []).map((tag) => ({ slug: tag.slug, name: decodeHtml(tag.name).trim() })),
    published: true,
    purchasable: Boolean(product.is_purchasable),
    inStock: variants.some((variant) => variant.available),
    storeApiParentInStock: Boolean(product.is_in_stock),
    prices: {
      currency: product.prices?.currency_code || 'USD',
      displayed: roundMoney(storePrice),
      uiDisplayed: roundMoney(productForm?.displayedPrice),
      min: allPrices.length ? roundMoney(Math.min(...allPrices)) : null,
      max: allPrices.length ? roundMoney(Math.max(...allPrices)) : null,
    },
    attributes: (product.attributes || []).map((attribute) => ({
      name: decodeHtml(attribute.name),
      terms: (attribute.terms || []).map((term) => decodeHtml(term.name)),
      selected: Object.entries(productForm?.selects || {}).find(([name]) => name.toLowerCase() === String(attribute.name).toLowerCase())?.[1]?.selected || null,
    })),
    defaultVariantLabel,
    defaultVariantIndex,
    variants,
    images: dedupedImages.map((image, index) => ({
      role: roleForImage(image, index, mainImage),
      src: image.src,
      alt: decodeHtml(image.alt || image.name || product.name),
    })),
    molecularStructureImage: extractMolecularImage(descriptionHtml),
    shortDescriptionHtml,
    descriptionHtml,
    descriptionHeadings: headings,
    researchInfo: extractResearchInfo(descriptionHtml),
    faqs: extractFaqs(descriptionHtml, wpMeta),
    contentTemplate: classifyDescription(headings, descriptionHtml, shortDescriptionHtml),
    dates: {
      published: wpMeta.date || null,
      modified: wpMeta.modified || null,
    },
    local: localProduct
      ? {
          id: localProduct.id,
          image: localProduct.image,
          order: localProduct.order,
          defaultOption: localProduct.defaultOption,
          detailFieldsPresent: false,
          diffs,
          stockDrift,
        }
      : null,
  }
})

const typeOrder = new Map(['vials', 'capsules', 'liquids', 'topicals'].map((type, index) => [type, index]))
products.sort((a, b) => {
  const localA = localByUrl.get(a.url)
  const localB = localByUrl.get(b.url)
  return (localA?.order ?? 9999) - (localB?.order ?? 9999)
    || (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99)
    || a.title.localeCompare(b.title)
})

const byType = Object.fromEntries(['vials', 'capsules', 'liquids', 'topicals'].map((type) => [type, products.filter((product) => product.type === type).length]))
const contentTemplateCounts = Object.fromEntries(
  [...new Set(products.map((product) => product.contentTemplate))]
    .sort()
    .map((template) => [template, products.filter((product) => product.contentTemplate === template).length]),
)
const localUrls = new Set(shopProducts.map((product) => normalizeUrl(product.productUrl)))
const liveUrls = new Set(products.map((product) => product.url))
const mismatchProducts = products
  .filter((product) => product.local?.diffs?.length)
  .map((product) => ({ slug: product.slug, diffs: product.local.diffs }))
const productsWithStockDrift = products.filter((product) => product.local?.stockDrift?.length)

const output = {
  source: {
    shop: SHOP_URL,
    productFeed: STORE_API,
    crawledAt: new Date().toISOString(),
    observedDetailPage: `${BASE}/product/5-amino-1mq/`,
  },
  summary: {
    productCount: products.length,
    byType,
    uniqueRoutes: new Set(products.map((product) => product.url)).size,
    productsWithVariants: products.filter((product) => product.variants.length > 0).length,
    productsWithShortDescription: products.filter((product) => stripHtml(product.shortDescriptionHtml)).length,
    productsWithLongDescription: products.filter((product) => stripHtml(product.descriptionHtml)).length,
    productsWithResearchInfo: products.filter((product) => product.researchInfo.length > 0).length,
    productsWithFaqs: products.filter((product) => product.faqs.length > 0).length,
    productsWithMolecularStructure: products.filter((product) => product.molecularStructureImage).length,
    totalGalleryImages: products.reduce((sum, product) => sum + product.images.length, 0),
    contentTemplates: contentTemplateCounts,
    sharedPageTemplate: {
      elementorTemplateId: 317,
      layout: ['product gallery', 'research categories', 'title and short description', 'variant/quantity purchase panel', 'usage notice', 'description', 'certificate-of-analysis callout', 'newsletter', 'footer'],
      categoryTemplateDifferences: 'The page shell is shared across vials, capsules, liquids, and topicals; product copy, galleries, attributes, prices, availability, and description structure vary.',
    },
  },
  existingShopDataComparison: {
    localProductCount: shopProducts.length,
    matchedByCanonicalUrl: products.filter((product) => product.local).length,
    missingLocally: products.filter((product) => !localUrls.has(product.url)).map((product) => product.url),
    extraLocally: shopProducts.filter((product) => !liveUrls.has(normalizeUrl(product.productUrl))).map((product) => product.productUrl),
    mismatchedProducts: mismatchProducts,
    stockQuantityDrift: {
      note: 'Inventory is dynamic; live values are retained on each product variant.',
      products: productsWithStockDrift.length,
      variants: productsWithStockDrift.reduce((sum, product) => sum + product.local.stockDrift.length, 0),
    },
    structuralGaps: [
      'shopData.js has no local product-route slug field.',
      'shopData.js has no short description or full description/research content.',
      'shopData.js has only one local image per product and no product gallery/COA image list.',
      'shopData.js has no molecular-structure image field.',
      'Shop Learn More currently opens the minimal ProductPreview modal instead of a /product/:slug/ detail route.',
    ],
  },
  products,
}

await fs.mkdir(OUTPUT_DIR, { recursive: true })
await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({
  output: path.relative(ROOT, OUTPUT_FILE),
  products: output.summary.productCount,
  byType,
  contentTemplates: contentTemplateCounts,
  mismatchedProducts: mismatchProducts.length,
  variationFormsParsed: productFormsById.size,
}, null, 2))
