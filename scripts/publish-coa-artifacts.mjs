import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = JSON.parse(await readFile(resolve('src/coaLibraryData.json'), 'utf8'))
const catalog = JSON.parse(await readFile(resolve('src/catalog.generated.json'), 'utf8'))
const writeJson = (path, value) => writeFile(path, `${JSON.stringify(value)}\n`, 'utf8')

for (const [category, page] of Object.entries(source)) {
  const categoryRoot = resolve('public/coa', catalog.version, category)
  const productRoot = resolve(categoryRoot, 'products')
  await mkdir(productRoot, { recursive: true })
  const items = page.items.map((item, index) => ({
    id: `${category}-${index + 1}`,
    product: item.product,
    batchCount: item.batches.length,
    batchIds: item.batches.map((batch) => batch.id),
  }))
  await Promise.all(page.items.map((item, index) => writeJson(
    resolve(productRoot, `${items[index].id}.json`),
    { id: items[index].id, product: item.product, batches: item.batches },
  )))
  await writeJson(resolve(categoryRoot, 'index.json'), { heading: page.heading, items })
}

console.log(`Published ${Object.keys(source).length} COA indexes with batch links split by product.`)
