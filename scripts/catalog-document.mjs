import { createHash } from 'node:crypto'
// Catalog version remains the checkout contract; this digest also covers independently generated metadata.
export function productDocumentFilename(document) {
  const digest = createHash('sha256').update(JSON.stringify(document)).digest('hex').slice(0, 20)
  return `${document.slug}.${digest}.json`
}
