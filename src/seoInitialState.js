// Read only inert, generated JSON/HTML from this document. Never use persisted customer data.
const initialPath = typeof window === 'undefined' ? '' : window.location.pathname
const initialMain = typeof document === 'undefined' ? '' : document.querySelector('[data-seo-shell] main')?.innerHTML || ''
let initialProduct = null
if (typeof document !== 'undefined') {
  try { initialProduct = JSON.parse(document.querySelector('#product-initial-data')?.textContent || 'null') } catch { /* A missing seed uses the immutable product document. */ }
}
export function initialProductDocument(productId, version) {
  return initialProduct?.productId === productId && initialProduct?.version === version ? initialProduct : null
}
export function initialRouteHtml(path) {
  return path === initialPath ? initialMain : ''
}
