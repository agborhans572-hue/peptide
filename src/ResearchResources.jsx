import { shopProducts } from './catalog.js'
import { appPath } from './appPath.js'
import { priorityProductSlugs, resourceLinks } from './researchLinks.js'

export default function ResearchResources({ products = true }) {
  return <section className="research-resources" aria-label="Research catalog and resources">
    <h2>Research catalog and resources</h2>
    <nav aria-label="Research resources">
      {resourceLinks.map(({ path, label }) => <a key={path} href={appPath(path)}>{label}</a>)}
      {products && priorityProductSlugs.map((slug) => {
        const product = shopProducts.find((item) => item.slug === slug)
        return product && <a key={slug} href={appPath(`/product/${slug}/`)}>{product.name} research product details</a>
      })}
    </nav>
  </section>
}
