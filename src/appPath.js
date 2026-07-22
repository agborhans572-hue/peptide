const BASE_PATH = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '') || ''

export function appPath(path = '/') {
  const normalized = `/${String(path).replace(/^\/+/, '')}`
  return `${BASE_PATH}${normalized}`
}

export function canonicalPath(pathname = '/') {
  const value = String(pathname)
  if (BASE_PATH && (value === BASE_PATH || value.startsWith(`${BASE_PATH}/`))) {
    return value.slice(BASE_PATH.length) || '/'
  }
  return value
}
