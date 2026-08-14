import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { productionRoutes } from './site-routes.mjs'

const access = JSON.parse(await readFile(resolve('catalog/product-route-access.generated.json'), 'utf8'))
const redirectCount = Object.keys(access.redirects || {}).length + (access.retired || []).length
const routeCount = productionRoutes.length + redirectCount
const budget = 1800

if (routeCount > budget) {
  throw new Error(`Deployment route budget exceeded: ${routeCount}/${budget}. Move product shells to a dynamic cached route before publishing.`)
}

console.log(`Deployment route budget: ${routeCount}/${budget} (${productionRoutes.length} routes, ${redirectCount} redirects).`)
