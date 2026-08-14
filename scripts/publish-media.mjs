import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, extname, relative, resolve, sep } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const apply = process.argv.includes('--apply')
const roots = [
  resolve('public/assets/product-details'),
  resolve('public/assets/shop'),
  resolve('public/assets/peptide-info'),
  resolve('public/_product-media'),
]
const contentTypes = {
  '.avif': 'image/avif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

async function files(directory) {
  const output = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) output.push(...await files(path))
    else if (entry.isFile()) output.push(path)
  }
  return output
}

const sourceFiles = (await Promise.all(roots.map(files))).flat().sort()
const prepared = await Promise.all(sourceFiles.map(async (path) => {
  const bytes = await readFile(path)
  const hash = createHash('sha256').update(bytes).digest('hex')
  const publicPath = `/${relative(resolve('public'), path).split(sep).join('/')}`
  const objectPath = `media/${hash}/${basename(path)}`
  const type = contentTypes[extname(path).toLowerCase()] || 'application/octet-stream'
  const metadata = type.startsWith('image/') ? await sharp(bytes).metadata().catch(() => ({})) : {}
  return { bytes, hash, objectPath, path, publicPath, type, width: metadata.width || null, height: metadata.height || null, format: metadata.format || null }
}))

const totalBytes = prepared.reduce((sum, item) => sum + item.bytes.length, 0)
console.log(`${apply ? 'Publishing' : 'Dry run:'} ${prepared.length} files (${(totalBytes / 1024 / 1024).toFixed(2)} MB).`)
if (!apply) {
  console.log('Run `npm run media:publish -- --apply` with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upload and verify.')
  process.exit(0)
}

const url = process.env.SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required with --apply.')
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const manifest = { assets: {}, generatedAt: new Date().toISOString(), version: 1 }
let cursor = 0

async function worker() {
  while (cursor < prepared.length) {
    const item = prepared[cursor]
    cursor += 1
    const { error } = await supabase.storage.from('product-media').upload(item.objectPath, item.bytes, {
      cacheControl: '31536000',
      contentType: item.type,
      upsert: false,
    })
    if (error && !/already exists|duplicate/i.test(error.message)) throw error
    const { data: downloaded, error: downloadError } = await supabase.storage.from('product-media').download(item.objectPath)
    if (downloadError || !downloaded) throw downloadError || new Error(`Could not verify ${item.objectPath}`)
    const remoteHash = createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex')
    if (remoteHash !== item.hash) throw new Error(`Checksum mismatch for ${item.publicPath}`)
    const { data: publicUrl } = supabase.storage.from('product-media').getPublicUrl(item.objectPath)
    manifest.assets[item.publicPath] = {
      bytes: item.bytes.length,
      contentType: item.type,
      format: item.format,
      formats: item.format ? [item.format] : [],
      height: item.height,
      sha256: item.hash,
      url: publicUrl.publicUrl,
      width: item.width,
    }
  }
}

await Promise.all(Array.from({ length: 5 }, worker))
manifest.assets = Object.fromEntries(Object.entries(manifest.assets).sort(([left], [right]) => left.localeCompare(right)))
await writeFile(resolve('catalog/media-manifest.generated.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
await writeFile(resolve('src/mediaManifest.generated.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Published and verified ${prepared.length} immutable media objects.`)
