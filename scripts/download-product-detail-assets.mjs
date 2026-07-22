import fs from 'node:fs/promises'
import { collectProductDetailAssets, PRODUCT_DETAIL_ASSET_PREFIX } from './product-detail-asset-utils.mjs'

const sourceUrl = new URL('../preview/reference-product-catalog/product-catalog-audit.json', import.meta.url)
const publicRootUrl = new URL('../public/', import.meta.url)
const manifestUrl = new URL('../public/assets/product-details/manifest.json', import.meta.url)
const source = JSON.parse(await fs.readFile(sourceUrl, 'utf8'))
const inventory = collectProductDetailAssets(source)
const force = process.argv.includes('--force')
const verifyOnly = process.argv.includes('--verify-only')
const concurrency = 8

function outputUrl(asset) {
  return new URL(`.${asset.publicPath}`, publicRootUrl)
}

async function existingSize(asset) {
  try {
    const stat = await fs.stat(outputUrl(asset))
    return stat.isFile() && stat.size > 0 ? stat.size : 0
  } catch {
    return 0
  }
}

async function fetchImage(asset) {
  let lastError

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(asset.sourceUrl, {
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; PureHealthPeptidesLocalRebuild/1.0)',
        },
        signal: AbortSignal.timeout(60_000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (contentType && !contentType.toLowerCase().startsWith('image/')) {
        throw new Error(`Unexpected content type: ${contentType}`)
      }

      const data = Buffer.from(await response.arrayBuffer())
      if (!data.length) throw new Error('Empty response body')

      const destination = outputUrl(asset)
      const temporary = new URL(`${destination.href}.part`)
      await fs.mkdir(new URL('./', destination), { recursive: true })
      await fs.writeFile(temporary, data)
      await fs.rename(temporary, destination)
      return data.length
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500))
      }
    }
  }

  throw new Error(`${asset.sourceUrl}: ${lastError?.message || lastError}`)
}

let nextIndex = 0
let downloaded = 0
let reused = 0
const failures = []
const assetList = [...inventory.values()]

async function worker() {
  while (true) {
    const index = nextIndex
    nextIndex += 1
    if (index >= assetList.length) return

    const asset = assetList[index]
    try {
      const size = await existingSize(asset)
      if (verifyOnly || (!force && size > 0)) {
        if (!size) throw new Error('Local file is missing or empty')
        reused += 1
      } else {
        await fetchImage(asset)
        downloaded += 1
      }
    } catch (error) {
      failures.push({ sourceUrl: asset.sourceUrl, publicPath: asset.publicPath, error: error.message })
    }

    if (!verifyOnly && (index + 1) % 25 === 0) {
      console.log(`Processed ${index + 1}/${assetList.length} assets...`)
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2))
  throw new Error(`${failures.length} product detail assets failed ${verifyOnly ? 'verification' : 'download'}.`)
}

const manifestAssets = []
let totalBytes = 0
for (const asset of assetList) {
  const bytes = await existingSize(asset)
  if (!bytes) throw new Error(`Downloaded asset is missing or empty: ${asset.publicPath}`)
  totalBytes += bytes
  manifestAssets.push({
    sourceUrl: asset.sourceUrl,
    publicPath: asset.publicPath,
    bytes,
    kinds: [...asset.kinds].sort(),
    roles: [...asset.roles].sort(),
    products: [...asset.products].sort(),
  })
}

const manifest = {
  version: 1,
  publicPrefix: PRODUCT_DETAIL_ASSET_PREFIX,
  productCount: source.products.length,
  assetCount: manifestAssets.length,
  totalBytes,
  assets: manifestAssets,
}

await fs.mkdir(new URL('./', manifestUrl), { recursive: true })
await fs.writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`${verifyOnly ? 'Verified' : 'Localized'} ${assetList.length} unique product-detail assets (${(totalBytes / 1024 / 1024).toFixed(2)} MiB).`)
if (!verifyOnly) console.log(`Downloaded ${downloaded}; reused ${reused}.`)
