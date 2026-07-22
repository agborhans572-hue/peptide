await import('./sync-woocommerce-catalog.mjs')
const { readFile } = await import('node:fs/promises')
const { resolve } = await import('node:path')
const diff = JSON.parse(await readFile(resolve('catalog/woocommerce-sync.diff.json'), 'utf8'))
const drift = diff.addedWooProductIds.length + diff.removedWooProductIds.length + diff.changedWooProductIds.length
if (drift) {
  console.error(`WooCommerce catalog drift detected: ${diff.addedWooProductIds.length} added, ${diff.removedWooProductIds.length} removed, ${diff.changedWooProductIds.length} changed.`)
  process.exit(1)
}
console.log('No WooCommerce catalog drift detected.')
