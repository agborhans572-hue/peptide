import { responsiveImage } from './responsiveImages.js'
import { mediaSrcSet, mediaUrl } from './mediaUrl.js'

export function responsiveImageProps(src, sizes) {
  const image = responsiveImage(src)
  const remote = mediaUrl(image?.src || src)
  const onError = remote !== src ? (event) => {
    event.currentTarget.removeAttribute('srcset')
    event.currentTarget.src = src
  } : undefined
  if (!image) return { src: remote, sizes, onError }
  return { src: remote, srcSet: mediaSrcSet(image.srcSet), sizes, width: image.width, height: image.height, onError }
}
