import manifest from './mediaManifest.generated.json' with { type: 'json' }

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
  return value.replace(/\b(src|href)=(['"])(\/[^'"]+)\2/gi, (match, attribute, quote, source) => (
    `${attribute}=${quote}${mediaUrl(source)}${quote} data-local-media-${attribute}=${quote}${source}${quote}`
  ))
}
