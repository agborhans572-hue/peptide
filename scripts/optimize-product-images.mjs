import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const catalog = JSON.parse(await readFile(resolve('catalog/catalog.generated.json'), 'utf8'))
const outputRoot = resolve('public/_product-media')
const responsiveRoot = resolve(outputRoot, 'responsive')
const socialRoot = resolve(outputRoot, 'social')
await Promise.all([mkdir(responsiveRoot, { recursive: true }), mkdir(socialRoot, { recursive: true })])

const sources = [...new Set(catalog.products.flatMap((product) => [
  product.image,
  ...product.options.map((variant) => variant.image),
]).filter((source) => source?.startsWith('/')))]
const manifest = { images: {}, social: {} }
const expectedResponsive = new Set()
const expectedSocial = new Set()

async function inBatches(items, size, worker) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker))
  }
}

await inBatches(sources, 8, async (source) => {
  const sourcePath = resolve('public', source.replace(/^\//, ''))
  const sourceInfo = await stat(sourcePath)
  const metadata = await sharp(sourcePath).metadata()
  const id = createHash('sha256').update(`${source}:${sourceInfo.size}:${sourceInfo.mtimeMs}`).digest('hex').slice(0, 16)
  const widths = [320, 640, 960].filter((width) => width <= (metadata.width || width))
  if (!widths.length && metadata.width) widths.push(metadata.width)
  const derivatives = []
  for (const width of widths) {
    const publicPath = `/_product-media/responsive/${id}-${width}.webp`
    expectedResponsive.add(publicPath.split('/').at(-1))
    await sharp(sourcePath).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 1 }).toFile(resolve('public', publicPath.replace(/^\//, '')))
    derivatives.push({ src: publicPath, width })
  }
  manifest.images[source] = {
    width: metadata.width,
    height: metadata.height,
    bytes: sourceInfo.size,
    srcSet: derivatives.map((item) => `${item.src} ${item.width}w`).join(', '),
  }
})

await inBatches(catalog.products, 6, async (product) => {
  const sourcePath = resolve('public', (product.options[product.defaultOption]?.image || product.image).replace(/^\//, ''))
  const foreground = await sharp(sourcePath).rotate().resize({ width: 760, height: 560, fit: 'contain', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer()
  const output = resolve(socialRoot, `${product.slug}.webp`)
  expectedSocial.add(`${product.slug}.webp`)
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#f3f8f5' } })
    .composite([{ input: foreground, gravity: 'center' }])
    .webp({ quality: 88, effort: 1 })
    .toFile(output)
  manifest.social[product.slug] = { src: `/_product-media/social/${product.slug}.webp`, width: 1200, height: 630, type: 'image/webp' }
})

await Promise.all([
  ...((await readdir(responsiveRoot)).filter((name) => !expectedResponsive.has(name)).map((name) => unlink(resolve(responsiveRoot, name)))),
  ...((await readdir(socialRoot)).filter((name) => !expectedSocial.has(name)).map((name) => unlink(resolve(socialRoot, name)))),
])

await writeFile(resolve('src/productImageManifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Generated responsive derivatives for ${sources.length} images and ${catalog.products.length} social images.`)
