import { readFile } from 'node:fs/promises'
import { validateCatalog } from './catalog-core.mjs'

const catalog = JSON.parse(await readFile(new URL('../catalog/catalog.generated.json', import.meta.url), 'utf8'))
const production = process.argv.includes('--production')
const errors = validateCatalog(catalog, { requireApprovedLogistics: production })
if (errors.length) {
  const visibleErrors = errors.slice(0, 50)
  const remainder = errors.length - visibleErrors.length
  console.error(`Catalog validation failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:\n- ${visibleErrors.join('\n- ')}${remainder ? `\n- …and ${remainder} more` : ''}`)
  process.exit(1)
}
const provisional = catalog.products.filter((product) => !product.logisticsApproved).length
console.log(`Catalog validation passed: ${catalog.products.length} products, ${catalog.products.reduce((sum, product) => sum + product.options.length, 0)} variants, ${provisional} products awaiting approved logistics.`)
