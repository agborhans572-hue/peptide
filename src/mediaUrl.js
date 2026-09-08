import manifest from './mediaManifest.generated.json' with { type: 'json' }
import { responsiveImage } from './responsiveImages.js'

export function mediaUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return value
  return manifest.assets?.[value]?.url || value
}

export function mediaSrcSet(value) {
  if (typeof value !== 'string') return value
  return value.split(',').map((candidate) => {
    const [source, width] = candidate.trim().split(/\s+/, 2)
    return `${mediaUrl(source)}${width ? ` ${width}` : ''}`
  }).join(', ')
}

export function rewriteMediaHtml(value) {
  if (typeof value !== 'string' || !value) return value
  const rewritten = value.replace(/\b(src|href)=(['"])(\/[^'"]+)\2/gi, (match, attribute, quote, source) => (
    `${attribute}=${quote}${mediaUrl(source)}${quote} data-local-media-${attribute}=${quote}${source}${quote}`
  ))
  return rewritten.replace(/<img\b([^>]*)>/gi, (tag, attributes) => {
    const source = attributes.match(/data-local-media-src=['"]([^'"]+)['"]/i)?.[1]
    const image = responsiveImage(source)
    if (!image) return tag
    const safeAttributes = attributes.replace(/\s(?:width|height|srcset|sizes|loading)=['"][^'"]*['"]/gi, '')
      .replace(/\bsrc=(['"])[^'"]+\1/i, `src="${mediaUrl(image.src || source)}"`)
    return `<img${safeAttributes} width="${image.width}" height="${image.height}" loading="lazy"${image.srcSet ? ` srcset="${mediaSrcSet(image.srcSet)}" sizes="(max-width: 800px) 92vw, 600px"` : ''}>`
  })
}
