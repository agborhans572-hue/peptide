import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const sourceConfig = JSON.parse(await readFile(resolve('catalog/catalog-source.json'), 'utf8'))
const reviewed = JSON.parse(await readFile(resolve(sourceConfig.reviewedSnapshot), 'utf8'))
const required = ['WOOCOMMERCE_URL', 'WC_CONSUMER_KEY', 'WC_CONSUMER_SECRET']
for (const name of required) if (!process.env[name]?.trim()) throw new Error(`${name} is required for authenticated catalog synchronization.`)

const origin = process.env.WOOCOMMERCE_URL
const authorization = `Basic ${Buffer.from(`${process.env.WC_CONSUMER_KEY}:${process.env.WC_CONSUMER_SECRET}`).toString('base64')}`
async function get(path) {
  const response = await fetch(new URL(`/wp-json/wc/v3/${path}`, origin), {
    headers: { Accept: 'application/json', Authorization: authorization },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`WooCommerce ${path} returned HTTP ${response.status}.`)
  return { value: await response.json(), totalPages: Number(response.headers.get('x-wp-totalpages') || 1) }
}

async function getAll(path) {
  const first = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=1`)
  const pages = [first.value]
  for (let page = 2; page <= first.totalPages; page += 1) {
    pages.push((await get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)).value)
  }
  return pages.flat()
}

const previousByWooId = new Map(reviewed.products.map((product) => [product.id, product]))
const currency = (await get('data/currencies/current')).value.code
if (currency !== 'USD') throw new Error(`WooCommerce store currency must be USD, received ${currency}.`)
const wooProducts = await getAll('products?status=any')
const typeCategories = new Set(['vials', 'capsules', 'liquids', 'topicals'])
const products = []

for (const product of wooProducts.sort((left, right) => left.id - right.id)) {
  const previous = previousByWooId.get(product.id)
  const variants = product.variations?.length
    ? await getAll(`products/${product.id}/variations?status=any`)
    : [product]
  const normalizedVariants = variants.map((variant) => {
    const attributes = Object.fromEntries((variant.attributes || []).map((attribute) => [String(attribute.name || attribute.slug).toLowerCase(), attribute.option]))
    return {
      id: variant.id,
      label: Object.values(attributes).join(' / ') || product.name,
      attributes,
      price: Number(variant.price),
      regularPrice: Number(variant.regular_price || variant.price),
      available: variant.status === 'publish' && variant.purchasable !== false && variant.stock_status === 'instock',
      stockQuantity: variant.stock_quantity == null ? null : Number(variant.stock_quantity),
      image: variant.image?.src || product.images?.[0]?.src || '',
    }
  })
  const published = product.status === 'publish'
  const visible = published && !['hidden', 'search'].includes(product.catalog_visibility)
  products.push({
    ...previous,
    id: product.id,
    slug: product.slug,
    url: product.permalink,
    title: product.name,
    documentTitle: `${product.name} - Pure Health Peptides`,
    type: previous?.type || product.categories.map((category) => category.slug).find((slug) => typeCategories.has(slug)),
    categories: product.categories.filter((category) => !typeCategories.has(category.slug)).map((category) => ({ slug: category.slug, name: category.name })),
    published,
    visible,
    purchasable: product.purchasable !== false,
    inStock: product.stock_status === 'instock',
    prices: {
      currency,
      min: Math.min(...normalizedVariants.map((variant) => variant.price)),
      max: Math.max(...normalizedVariants.map((variant) => variant.price)),
    },
    variants: normalizedVariants,
    images: (product.images || []).map((image, index) => ({ role: index === 0 ? 'primary' : 'gallery', src: image.src, alt: image.alt || `${product.name} ${index === 0 ? 'product' : `gallery image ${index + 1}`}` })),
    shortDescriptionHtml: product.short_description,
    descriptionHtml: product.description,
    dates: { published: product.date_created, modified: product.date_modified },
    local: previous?.local || null,
  })
}

const candidate = {
  source: { shop: new URL('/shop/', origin).href, productFeed: new URL('/wp-json/wc/v3/products', origin).href, crawledAt: new Date().toISOString(), mode: 'authenticated-woocommerce-rest' },
  products,
}
const commercialView = (product) => ({
  id: product.id, slug: product.slug, title: product.title, type: product.type, categories: product.categories,
  published: product.published, visible: product.visible, purchasable: product.purchasable,
  shortDescriptionHtml: product.shortDescriptionHtml, descriptionHtml: product.descriptionHtml,
  variants: product.variants, images: product.images,
})
const previousIds = new Set(reviewed.products.map((product) => product.id))
const nextIds = new Set(products.map((product) => product.id))
const changed = products.filter((product) => JSON.stringify(commercialView(product)) !== JSON.stringify(commercialView(previousByWooId.get(product.id) || {}))).map((product) => product.id)
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const diff = {
  previousSha256: digest(reviewed.products.map(commercialView)),
  candidateSha256: digest(products.map(commercialView)),
  addedWooProductIds: [...nextIds].filter((id) => !previousIds.has(id)),
  removedWooProductIds: [...previousIds].filter((id) => !nextIds.has(id)),
  changedWooProductIds: changed,
  productCount: { previous: reviewed.products.length, candidate: products.length },
}
await writeFile(resolve(sourceConfig.candidateSnapshot), `${JSON.stringify(candidate, null, 2)}\n`, 'utf8')
await writeFile(resolve(sourceConfig.diff), `${JSON.stringify(diff, null, 2)}\n`, 'utf8')
console.log(`Woo candidate written with ${products.length} products; ${diff.addedWooProductIds.length} added, ${diff.removedWooProductIds.length} removed, ${changed.length} changed.`)
