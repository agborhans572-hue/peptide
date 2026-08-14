import catalog from './catalog.generated.json' with { type: 'json' }
import { mediaUrl } from './mediaUrl.js'

export const catalogVersion = catalog.version
export const catalogSource = catalog.source
export const shopProducts = catalog.products.map((product) => ({
  ...product,
  mediaSource: product.image,
  image: mediaUrl(product.image),
  options: product.options.map((option) => ({ ...option, mediaSource: option.image, image: mediaUrl(option.image) })),
}))
export default { ...catalog, products: shopProducts }
