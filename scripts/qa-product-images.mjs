import { mkdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const [catalog, manifest] = await Promise.all([
  readFile(resolve('catalog/catalog.generated.json'), 'utf8').then(JSON.parse),
  readFile(resolve('src/productImageManifest.json'), 'utf8').then(JSON.parse),
])
const errors = []
const tiles = []
const tileWidth = 180
const tileHeight = 120
const columns = 5

for (const product of catalog.products) {
  const source = manifest.social[product.slug]
  if (!source || source.width !== 1200 || source.height !== 630 || source.type !== 'image/webp') errors.push(`${product.id}: invalid social image manifest`)
  const sourcePath = resolve('public', source?.src?.replace(/^\//, '') || 'missing')
  try {
    const file = await stat(sourcePath)
    if (file.size > 350_000) errors.push(`${product.id}: social image is larger than 350 KB`)
    const metadata = await sharp(sourcePath).metadata()
    if (metadata.width !== 1200 || metadata.height !== 630) errors.push(`${product.id}: social image is not 1200x630`)
    tiles.push(await sharp(sourcePath).resize({ width: tileWidth, height: tileHeight, fit: 'cover' }).webp({ quality: 70 }).toBuffer())
  } catch {
    errors.push(`${product.id}: social image file is missing`)
  }
  for (const variant of product.options) {
    const image = manifest.images[variant.image]
    if (!image?.srcSet || !image.width || !image.height) errors.push(`${product.id}/${variant.id}: responsive image metadata is missing`)
  }
}

if (errors.length) {
  console.error(`Product image QA failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

const rows = Math.ceil(tiles.length / columns)
await mkdir(resolve('artifacts'), { recursive: true })
await sharp({ create: { width: columns * tileWidth, height: rows * tileHeight, channels: 3, background: '#ffffff' } })
  .composite(tiles.map((input, index) => ({ input, left: (index % columns) * tileWidth, top: Math.floor(index / columns) * tileHeight })))
  .webp({ quality: 82 })
  .toFile(resolve('artifacts/product-image-contact-sheet.webp'))

console.log(`Product image QA passed for ${catalog.products.length} products; contact sheet written to artifacts/product-image-contact-sheet.webp.`)
