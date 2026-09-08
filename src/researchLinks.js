export const priorityProductSlugs = ['bpc-157', 'bpc-157-tb-500', 'n-acetyl-semax-amidate']

export function relatedResearchProducts(product, products, count = 4) {
  const categories = new Set(product.categories || [])
  return products.filter((candidate) => candidate.id !== product.id)
    .map((candidate) => ({ candidate, score:
      (candidate.type === product.type ? 12 : 0)
      + (candidate.categories || []).filter((category) => categories.has(category)).length * 5
      + Math.min(Number(candidate.popularity || 0) / 5000, 2),
    }))
    .sort((a, b) => b.score - a.score || a.candidate.slug.localeCompare(b.candidate.slug))
    .slice(0, count).map(({ candidate }) => candidate)
}

export const resourceLinks = [
  { path: '/shipping-policy/', label: 'U.S. shipping rates and delivery estimates' },
  { path: '/refund-policy/', label: 'Return authorization and refund policy' },
  { path: '/coa-library/', label: 'Find batch Certificates of Analysis' },
  { path: '/coa-process/', label: 'How independent peptide testing works' },
]
