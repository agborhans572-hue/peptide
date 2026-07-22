import { createHash } from 'node:crypto'
import path from 'node:path'

export const PRODUCT_DETAIL_ASSET_PREFIX = '/assets/product-details'

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function assetFilename(sourceUrl) {
  const url = new URL(sourceUrl)
  const originalName = safeDecode(path.posix.basename(url.pathname)) || 'image.jpg'
  const extension = path.posix.extname(originalName).toLowerCase() || '.jpg'
  const stem = path.posix.basename(originalName, path.posix.extname(originalName))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'image'
  const urlHash = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 12)

  return `${stem}-${urlHash}${extension}`
}

export function collectProductDetailAssets(source) {
  const byUrl = new Map()

  function add(sourceUrl, kind, productSlug, role = null) {
    if (!sourceUrl || typeof sourceUrl !== 'string') return

    const existing = byUrl.get(sourceUrl) || {
      sourceUrl,
      kinds: new Set(),
      products: new Set(),
      roles: new Set(),
    }

    existing.kinds.add(kind)
    existing.products.add(productSlug)
    if (role) existing.roles.add(role)
    byUrl.set(sourceUrl, existing)
  }

  for (const product of source.products) {
    for (const image of product.images || []) {
      add(image?.src, 'gallery', product.slug, image?.role)
    }
    add(product.molecularStructureImage, 'molecular', product.slug)
  }

  return new Map([...byUrl.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([sourceUrl, entry]) => {
    // A URL shared by both types is stored once in the molecular directory.
    const directory = entry.kinds.has('molecular') ? 'molecular' : 'gallery'
    const publicPath = `${PRODUCT_DETAIL_ASSET_PREFIX}/${directory}/${assetFilename(sourceUrl)}`

    return [sourceUrl, {
      ...entry,
      directory,
      publicPath,
    }]
  }))
}

export function replaceProductDetailAssetUrls(html, assetInventory) {
  let result = html || ''

  for (const [sourceUrl, asset] of assetInventory) {
    if (result.includes(sourceUrl)) {
      result = result.split(sourceUrl).join(asset.publicPath)
    }
  }

  return result
}
