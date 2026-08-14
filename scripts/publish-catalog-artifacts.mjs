import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const catalog = JSON.parse(await readFile(resolve('src/catalog.generated.json'), 'utf8'))
const details = JSON.parse(await readFile(resolve('src/productDetailData.json'), 'utf8'))
const metadata = JSON.parse(await readFile(resolve('src/productRouteMetadata.json'), 'utf8'))
const versionRoot = resolve('public/catalog', catalog.version)
const productRoot = resolve(versionRoot, 'products')
const categoryRoot = resolve(versionRoot, 'categories')

await mkdir(productRoot, { recursive: true })
await mkdir(categoryRoot, { recursive: true })

const writeJson = (path, value) => writeFile(path, `${JSON.stringify(value)}\n`, 'utf8')
const cards = catalog.products.map((product) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  type: product.type,
  categories: product.categories,
  image: product.image,
  imageAlt: product.imageAlt,
  displayPrice: product.displayPrice,
  priceCents: product.priceCents,
  currency: product.currency,
  options: product.options,
}))

await Promise.all(catalog.products.map(async (product) => {
  const routePath = `/product/${product.slug}/`
  const detail = details[product.detailKey || product.slug]
  if (!detail) throw new Error(`Missing detail data for ${product.slug}.`)
  await writeJson(resolve(productRoot, `${product.slug}.json`), {
    version: catalog.version,
    productId: product.id,
    slug: product.slug,
    detail,
    metadata: metadata[routePath] || null,
  })
}))

await Promise.all(catalog.categories.map(async (category) => {
  await writeJson(resolve(categoryRoot, `${category.slug}.json`), {
    version: catalog.version,
    category,
    products: cards.filter((product) => product.categories.includes(category.slug)),
  })
}))

await writeJson(resolve(versionRoot, 'index.json'), {
  version: catalog.version,
  source: catalog.source,
  categories: catalog.categories,
  products: cards,
})
await writeJson(resolve(versionRoot, 'featured.json'), {
  version: catalog.version,
  products: cards.filter((product) => product.featured).slice(0, 12).length
    ? cards.filter((product) => product.featured).slice(0, 12)
    : cards.slice(0, 12),
})
await writeJson(resolve('public/catalog/current.json'), {
  version: catalog.version,
  index: `/catalog/${catalog.version}/index.json`,
  featured: `/catalog/${catalog.version}/featured.json`,
})

console.log(`Published immutable catalog ${catalog.version} with ${catalog.products.length} product documents.`)
