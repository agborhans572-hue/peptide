import { mkdir, writeFile } from 'node:fs/promises'
import { shopProducts } from '../src/shopData.js'

const catalog = shopProducts.map((product) => ({
  id: product.id,
  name: product.name,
  image: product.image,
  discountRule: product.discountRule,
  options: product.options.map((option) => ({
    label: option.label,
    price: option.price,
    available: option.available,
    maxQty: option.maxQty,
  })),
}))

await mkdir(new URL('../server/', import.meta.url), { recursive: true })
await writeFile(
  new URL('../server/catalog.generated.json', import.meta.url),
  `${JSON.stringify(catalog, null, 2)}\n`,
  'utf8',
)

console.log(`Generated server catalog with ${catalog.length} products.`)
