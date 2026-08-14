import manifest from './productImageManifest.json' with { type: 'json' }
import { mediaSrcSet, mediaUrl } from './mediaUrl.js'

export function responsiveImageProps(src, sizes) {
  const image = manifest.images[src]
  const remote = mediaUrl(src)
  const onError = remote !== src ? (event) => {
    event.currentTarget.removeAttribute('srcset')
    event.currentTarget.src = src
  } : undefined
  if (!image) return { src: remote, sizes, onError }
  return { src: remote, srcSet: mediaSrcSet(image.srcSet), sizes, width: image.width, height: image.height, onError }
}
