import { createHash } from 'node:crypto'
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const catalog = JSON.parse(await readFile(resolve('catalog/catalog.generated.json'), 'utf8'))
const outputRoot = resolve('public/_product-media')
const responsiveRoot = resolve(outputRoot, 'responsive')
const socialRoot = resolve(outputRoot, 'social')
await Promise.all([mkdir(responsiveRoot, { recursive: true }), mkdir(socialRoot, { recursive: true })])

async function rasterSources(directory = 'public/assets') {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = directory + '/' + entry.name
    if (entry.isDirectory()) files.push(...await rasterSources(path))
    else if (/\.(png|jpe?g|webp|svg)$/i.test(entry.name)) files.push(path.replace(/^public/, ''))
  }
  return files
}
const sources = [...new Set([...(await rasterSources()), ...catalog.products.flatMap((product) => [
  product.image,
  ...product.options.map((variant) => variant.image),
]).filter((source) => source?.startsWith('/'))])]
const manifest = { images: {}, social: {} }

async function inBatches(items, size, worker) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker))
  }
}

await inBatches(sources, 8, async (source) => {
  const sourcePath = resolve('public', source.replace(/^\//, ''))
  const sourceInfo = await stat(sourcePath)
  const metadata = await sharp(sourcePath).metadata()
  if (source.endsWith('.svg')) {
    manifest.images[source] = { width: metadata.width, height: metadata.height, bytes: sourceInfo.size }
    return
  }
  const sourceBytes = await readFile(sourcePath)
  const id = createHash('sha256').update(sourceBytes).digest('hex').slice(0, 16)
  const widths = [160, 320, 640, 960].filter((width) => width <= (metadata.width || width))
  if (!widths.length && metadata.width) widths.push(metadata.width)
  const derivatives = []
  for (const width of widths) {
    const webpPath = `/_product-media/responsive/${id}-${width}.webp`

    const webpDestination = resolve('public', webpPath.replace(/^\//, ''))
    await access(webpDestination).catch(async () => {
      await sharp(sourcePath).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 1 }).toFile(webpDestination)
    })
    derivatives.push({ src: webpPath, width })
  }
  manifest.images[source] = {
    width: metadata.width,
    height: metadata.height,
    bytes: sourceInfo.size,
    src: derivatives.find((item) => item.width === 640)?.src || derivatives.at(-1)?.src,
    srcSet: derivatives.map((item) => `${item.src} ${item.width}w`).join(', '),
  }
})

await inBatches(catalog.products, 6, async (product) => {
  const sourcePath = resolve('public', (product.options[product.defaultOption]?.image || product.image).replace(/^\//, ''))
  const foreground = await sharp(sourcePath).rotate().resize({ width: 760, height: 560, fit: 'contain', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer()
  const output = resolve(socialRoot, `${product.slug}.webp`)
  await access(output).catch(async () => {
    await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#f3f8f5' } })
      .composite([{ input: foreground, gravity: 'center' }])
      .webp({ quality: 88, effort: 1 })
      .toFile(output)
  })
  manifest.social[product.slug] = { src: `/_product-media/social/${product.slug}.webp`, width: 1200, height: 630, type: 'image/webp' }
})

// Retain immutable derivatives referenced by previous deployments.

const deterministicManifest = {
  images: Object.fromEntries(Object.entries(manifest.images).sort(([left], [right]) => left.localeCompare(right))),
  social: Object.fromEntries(Object.entries(manifest.social).sort(([left], [right]) => left.localeCompare(right))),
}

await writeFile(resolve('src/productImageManifest.json'), `${JSON.stringify(deterministicManifest, null, 2)}\n`, 'utf8')
const clientImages = Object.fromEntries(Object.entries(deterministicManifest.images).map(([source, image]) => [source, [image.width, image.height, ...(image.src ? [image.src.match(/\/([a-f0-9]+)-/)[1], [...image.srcSet.matchAll(/ (\d+)w/g)].map((m) => Number(m[1])), Number(image.src.match(/-(\d+)\.webp$/)[1])] : [])]]))
await writeFile(resolve('src/responsiveImageManifest.json'), `${JSON.stringify(clientImages)}\n`, 'utf8')
console.log(`Generated responsive derivatives for ${sources.length} images and ${catalog.products.length} social images.`)
