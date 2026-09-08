import images from './responsiveImageManifest.json' with { type: 'json' }
const cache = new Map()
// Compact source dimensions and derivative widths avoid repeating every asset URL in the initial JS.
export function responsiveImage(source) {
  if (cache.has(source)) return cache.get(source)
  const data = images[source]
  if (!data) return undefined
  const [width, height, digest, widths, fallbackWidth] = data
  const base = digest ? `/_product-media/responsive/${digest}-` : null
  const image = { width, height, ...(base ? { src: `${base}${fallbackWidth}.webp`, srcSet: widths.map((size) => `${base}${size}.webp ${size}w`).join(', ') } : {}) }
  cache.set(source, image)
  return image
}
