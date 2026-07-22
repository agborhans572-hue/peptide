import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const config = JSON.parse(await readFile(resolve('catalog/catalog-source.json'), 'utf8'))
const [candidate, diff, retired] = await Promise.all([
  readFile(resolve(config.candidateSnapshot), 'utf8').then(JSON.parse),
  readFile(resolve(config.diff), 'utf8').then(JSON.parse),
  readFile(resolve('catalog/retired-products.json'), 'utf8').then(JSON.parse),
])
if (!Array.isArray(candidate.products) || !candidate.source?.mode?.startsWith('authenticated')) throw new Error('Candidate is not an authenticated WooCommerce snapshot.')
const retiredIds = new Set(retired.map((item) => Number(typeof item === 'object' ? item.wooProductId : Number.NaN)).filter(Number.isFinite))
const uncoveredRemoved = diff.removedWooProductIds.filter((id) => !retiredIds.has(Number(id)))
if (uncoveredRemoved.length) throw new Error(`Removed Woo products must be recorded in catalog/retired-products.json before approval: ${uncoveredRemoved.join(', ')}`)
await writeFile(resolve(config.reviewedSnapshot), `${JSON.stringify(candidate, null, 2)}\n`, 'utf8')
console.log(`Approved candidate as the reviewed snapshot. Commit the snapshot and deterministic diff together.`)
