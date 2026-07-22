import manifest from './productImageManifest.json' with { type: 'json' }

export function responsiveImageProps(src, sizes) {
  const image = manifest.images[src]
  if (!image) return { src, sizes }
  return { src, srcSet: image.srcSet, sizes, width: image.width, height: image.height }
}
