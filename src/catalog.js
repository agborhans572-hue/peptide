import catalog from './catalog.generated.json' with { type: 'json' }

export const catalogVersion = catalog.version
export const catalogSource = catalog.source
export const shopProducts = catalog.products
export default catalog
