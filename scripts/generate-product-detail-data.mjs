import fs from 'node:fs/promises'
import { collectProductDetailAssets, replaceProductDetailAssetUrls } from './product-detail-asset-utils.mjs'

const sourceUrl = new URL('../preview/reference-product-catalog/product-catalog-audit.json', import.meta.url)
const outputUrl = new URL('../src/productDetailData.json', import.meta.url)
const splitOutputUrl = new URL('../src/productDetailData/', import.meta.url)
const manifestOutputUrl = new URL('../src/productDetailManifest.json', import.meta.url)
const publicRootUrl = new URL('../public/', import.meta.url)
const source = JSON.parse(await fs.readFile(sourceUrl, 'utf8'))
const assetInventory = collectProductDetailAssets(source)

for (const asset of assetInventory.values()) {
  try {
    const stat = await fs.stat(new URL(`.${asset.publicPath}`, publicRootUrl))
    if (!stat.isFile() || stat.size === 0) throw new Error('empty file')
  } catch {
    throw new Error(`Missing localized product-detail asset ${asset.publicPath}. Run node scripts/download-product-detail-assets.mjs first.`)
  }
}

const details = Object.fromEntries(source.products.map((product) => [product.slug, {
  categories: product.categories,
  contentTemplate: product.contentTemplate,
  descriptionHtml: replaceProductDetailAssetUrls(product.descriptionHtml, assetInventory),
  documentTitle: product.documentTitle,
  images: (product.images || []).map((image) => ({
    ...image,
    src: assetInventory.get(image.src)?.publicPath || image.src,
  })),
  molecularStructureImage: assetInventory.get(product.molecularStructureImage)?.publicPath || product.molecularStructureImage,
  shortDescriptionHtml: product.shortDescriptionHtml,
  title: product.title,
  type: product.type,
}]))

await fs.writeFile(outputUrl, `${JSON.stringify(details, null, 2)}\n`)
await fs.mkdir(splitOutputUrl, { recursive: true })

const productTypes = ['vials', 'capsules', 'liquids', 'topicals']
const splitCounts = {}

for (const type of productTypes) {
  const typeDetails = Object.fromEntries(
    Object.entries(details).filter(([, detail]) => detail.type === type),
  )
  splitCounts[type] = Object.keys(typeDetails).length
  await fs.writeFile(
    new URL(`${type}.json`, splitOutputUrl),
    `${JSON.stringify(typeDetails, null, 2)}\n`,
  )
}

const manifest = Object.fromEntries(
  Object.entries(details).map(([slug, detail]) => [slug, detail.documentTitle]),
)
await fs.writeFile(manifestOutputUrl, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`Generated product detail data for ${Object.keys(details).length} routes (${productTypes.map((type) => `${type}: ${splitCounts[type]}`).join(', ')}).`)
