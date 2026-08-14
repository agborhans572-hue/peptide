import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const manifest = JSON.parse(await readFile(resolve('dist/.vite/manifest.json'), 'utf8'))
const gzipCache = new Map()

async function gzipBytes(file) {
  if (!gzipCache.has(file)) {
    const bytes = await readFile(resolve('dist', file))
    gzipCache.set(file, gzipSync(bytes, { level: 9 }).length)
  }
  return gzipCache.get(file)
}

function dependencyFiles(keys) {
  const files = new Set()
  const visited = new Set()
  function visit(key) {
    if (!key || visited.has(key)) return
    visited.add(key)
    const entry = manifest[key]
    if (!entry) throw new Error(`Vite manifest is missing ${key}.`)
    if (entry.file?.endsWith('.js')) files.add(entry.file)
    for (const imported of entry.imports || []) visit(imported)
  }
  keys.forEach(visit)
  return files
}

async function assertBudget(label, keys, maximumKb) {
  const files = dependencyFiles(keys)
  const bytes = (await Promise.all([...files].map(gzipBytes))).reduce((sum, value) => sum + value, 0)
  const kb = bytes / 1024
  if (kb > maximumKb) throw new Error(`${label} JavaScript is ${kb.toFixed(1)} KB gzip; budget is ${maximumKb} KB.`)
  console.log(`${label}: ${kb.toFixed(1)} KB gzip across ${files.size} JavaScript files (budget ${maximumKb} KB).`)
}

await assertBudget('Initial route', ['index.html'], 160)
await assertBudget('Shop route', ['index.html', 'src/ShopPage.jsx'], 220)
await assertBudget('Product route', ['index.html', 'src/ProductDetailPage.jsx'], 220)
