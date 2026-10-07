import './policy.css'
import { policies } from './policyData.js'
import ResearchResources from './ResearchResources.jsx'

export default function PolicyPage({ type }) {
  const policy = policies[type]
  if (!policy) return null
  return (
    <article className="policy-page">
      <header>
        <span>{policy.eyebrow}</span>
        <h1>{policy.title}</h1>
        <p>Effective July 20, 2026</p>
      </header>
      <div className="policy-content">
        {policy.sections.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
        <section>
          <h2>Contact</h2>
          <p>Questions may be sent to <a href="mailto:info@purehealthpeptidesshop.com">info@purehealthpeptidesshop.com</a>.</p>
        </section>
      </div>
      <ResearchResources products={false} />
    </article>
  )
}
