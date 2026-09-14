import { ArrowRight, BookOpen, CheckCircle2, Clock3, FlaskConical, ShieldCheck } from 'lucide-react'
import { appPath } from './appPath.js'
import {
  educationArticleBySlug,
  educationArticlePath,
  publishedEducationArticles,
  scheduledEducationArticles,
} from './educationArticles.js'
import './education.css'

const formatDate = (value) => new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeZone: 'UTC',
}).format(new Date(`${value}T00:00:00Z`))

function ArticleCard({ article }) {
  return (
    <article className="education-card">
      <p className="education-card-category">{article.category}</p>
      <h2><a href={appPath(educationArticlePath(article))}>{article.title}</a></h2>
      <p>{article.description}</p>
      <div className="education-card-meta">
        <span>{formatDate(article.publishedAt)}</span>
        <span><Clock3 aria-hidden="true" /> {article.readingMinutes} min read</span>
      </div>
      <a className="education-card-link" href={appPath(educationArticlePath(article))}>
        Read the guide <ArrowRight aria-hidden="true" />
      </a>
    </article>
  )
}

export function LearningCenterPage() {
  return (
    <div className="education-page education-hub">
      <header className="education-hub-hero">
        <div>
          <p className="education-kicker">Peptide testing &amp; laboratory guides</p>
          <h1>Evidence-led guidance for research materials</h1>
          <p>Practical explanations of analytical reports, material identity, storage controls, and batch traceability—written for readers who want to understand what the documentation actually supports.</p>
        </div>
      </header>

      <section className="education-principles" aria-label="Editorial principles">
        <article><BookOpen aria-hidden="true" /><div><h2>Primary sources</h2><p>Claims link to standards, regulators, scientific references, and peer-reviewed literature.</p></div></article>
        <article><FlaskConical aria-hidden="true" /><div><h2>Method-aware</h2><p>We separate identity, purity, content, quantity, and stability instead of blending them into one claim.</p></div></article>
        <article><ShieldCheck aria-hidden="true" /><div><h2>Research-only scope</h2><p>These guides support laboratory documentation and do not give medical or administration advice.</p></div></article>
      </section>

      <section className="education-library">
        <div className="education-section-heading">
          <div>
            <p className="education-kicker">Learning library</p>
            <h2>Start with the question in front of you</h2>
          </div>
          <p>Each guide includes a direct answer, a practical review checklist, limitations, related resources, and its source list.</p>
        </div>
        <div className="education-grid">
          {publishedEducationArticles.map((article) => <ArticleCard article={article} key={article.slug} />)}
        </div>
      </section>

      <section className="education-upcoming" aria-labelledby="publishing-schedule-heading">
        <div>
          <p className="education-kicker">Publishing schedule</p>
          <h2 id="publishing-schedule-heading">Two focused guides each week</h2>
          <p>The remaining articles are complete editorial drafts, but they stay out of search and public article routes until their scheduled release review.</p>
        </div>
        <ol>
          {scheduledEducationArticles.map((article) => (
            <li key={article.slug}>
              <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
              <strong>{article.title}</strong>
              <span>Scheduled</span>
            </li>
          ))}
        </ol>
      </section>

      <aside className="education-editorial-banner">
        <div>
          <p className="education-kicker">How this library is made</p>
          <h2>Transparent authorship, sourcing, and corrections</h2>
          <p>Every article identifies the responsible organizational author, publication and update dates, the evidence consulted, and the limits of the page.</p>
        </div>
        <a href={appPath('/editorial-standards/')}>Read our editorial standards <ArrowRight aria-hidden="true" /></a>
      </aside>
    </div>
  )
}

function RelatedArticles({ article }) {
  const related = article.related.map((slug) => educationArticleBySlug[slug]).filter((item) => item?.status === 'published')
  return (
    <section className="article-related" aria-labelledby="related-guides-heading">
      <div className="article-heading-row">
        <p className="education-kicker">Continue learning</p>
        <h2 id="related-guides-heading">Related laboratory guides</h2>
      </div>
      <div className="article-related-grid">
        {related.map((item) => (
          <a href={appPath(educationArticlePath(item))} key={item.slug}>
            <span>{item.category}</span>
            <strong>{item.shortTitle}</strong>
            <ArrowRight aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  )
}

export function EducationArticlePage({ slug }) {
  const article = educationArticleBySlug[slug]
  if (!article || article.status !== 'published') return <section className="education-missing"><h1>Guide not found</h1><a href={appPath('/news/')}>Browse laboratory guides</a></section>

  return (
    <article className="education-page education-article">
      <header className="article-hero">
        <div>
          <nav className="article-breadcrumbs" aria-label="Breadcrumb">
            <a href={appPath('/')}>Home</a><span aria-hidden="true">/</span>
            <a href={appPath('/news/')}>Laboratory guides</a><span aria-hidden="true">/</span>
            <span aria-current="page">{article.shortTitle}</span>
          </nav>
          <p className="education-kicker">{article.category}</p>
          <h1>{article.title}</h1>
          <p className="article-dek">{article.description}</p>
          <div className="article-byline">
            <div className="article-byline-mark" aria-hidden="true">PHP</div>
            <p>
              <span>Written by <a href={appPath('/editorial-standards/')}>Pure Health Peptides Editorial Team</a></span>
              <span>Published {formatDate(article.publishedAt)} · Updated {formatDate(article.updatedAt)} · {article.readingMinutes} min read</span>
            </p>
          </div>
        </div>
      </header>

      <div className="article-layout">
        <div className="article-body">
          <aside className="article-scope-note">
            <strong>Educational scope</strong>
            <p>This guide addresses analytical documentation and controlled laboratory research materials. It is not medical advice and does not provide instructions for human or veterinary use.</p>
          </aside>

          <section className="article-answer" aria-labelledby="quick-answer-heading">
            <p className="education-kicker">Quick answer</p>
            <h2 id="quick-answer-heading">The point in plain language</h2>
            <p>{article.quickAnswer}</p>
          </section>

          <section className="article-takeaways" aria-labelledby="takeaways-heading">
            <h2 id="takeaways-heading">Key takeaways</h2>
            <ul>{article.takeaways.map((item) => <li key={item}><CheckCircle2 aria-hidden="true" /><span>{item}</span></li>)}</ul>
          </section>

          {article.sections.map((section, index) => (
            <section className="article-section" id={`section-${index + 1}`} key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}

          <section className="article-internal-links" aria-labelledby="apply-heading">
            <p className="education-kicker">Use the documentation</p>
            <h2 id="apply-heading">Apply this guide on our site</h2>
            <div>{article.internalLinks.map((link) => <a href={appPath(link.path)} key={link.path}>{link.label}<ArrowRight aria-hidden="true" /></a>)}</div>
          </section>

          <section className="article-sources" aria-labelledby="sources-heading">
            <h2 id="sources-heading">Sources and further reading</h2>
            <p>Sources were selected for analytical definitions and quality-documentation principles. Regulatory drug guidance is identified as a benchmark and is not presented as proof of a research material’s regulatory status.</p>
            <ol>
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url}>{source.title}</a>
                  <span>{source.publisher}. {source.note}</span>
                </li>
              ))}
            </ol>
          </section>

          <aside className="article-method-note">
            <h2>About this article</h2>
            <p>Prepared by the Pure Health Peptides Editorial Team using AI-assisted drafting and source research. Claims were checked against the references listed above; AI output is not presented as laboratory evidence. No named scientific reviewer is claimed. See our <a href={appPath('/editorial-standards/')}>editorial standards and corrections process</a>.</p>
          </aside>
        </div>

        <aside className="article-sidebar" aria-label="On this page">
          <p>On this page</p>
          <ol>
            <li><a href="#quick-answer-heading">Quick answer</a></li>
            <li><a href="#takeaways-heading">Key takeaways</a></li>
            {article.sections.map((section, index) => <li key={section.heading}><a href={`#section-${index + 1}`}>{section.heading}</a></li>)}
            <li><a href="#sources-heading">Sources</a></li>
          </ol>
        </aside>
      </div>

      <RelatedArticles article={article} />
    </article>
  )
}

export function EditorialStandardsPage() {
  return (
    <article className="education-page editorial-page">
      <header className="editorial-hero">
        <div>
          <nav className="article-breadcrumbs" aria-label="Breadcrumb"><a href={appPath('/')}>Home</a><span aria-hidden="true">/</span><span aria-current="page">Editorial standards</span></nav>
          <p className="education-kicker">Trust &amp; accountability</p>
          <h1>Editorial standards for laboratory education</h1>
          <p>How we attribute, source, review, disclose, update, and correct educational content about peptide research materials.</p>
          <p className="editorial-updated">Last updated September 14, 2026</p>
        </div>
      </header>

      <div className="editorial-body">
        <section>
          <h2>Who is responsible</h2>
          <p>Articles are published under the Pure Health Peptides Editorial Team when the organization—not a named individual—is responsible for the page. We do not invent author biographies, degrees, laboratory affiliations, or reviewer credentials. If a qualified individual reviews an article in the future, the page will name that person and link to verifiable background information with their permission.</p>
        </section>
        <section>
          <h2>Why we publish</h2>
          <p>Our guides help laboratory customers interpret the identity, purity, batch, storage, and traceability information associated with research materials. They are educational, research-use-only resources. They do not diagnose, treat, recommend personal use, or replace a laboratory’s risk assessment, validated method, safety documentation, or SOP.</p>
        </section>
        <section>
          <h2>How an article is prepared</h2>
          <ol>
            <li><strong>Define the reader’s task.</strong> The page begins with a real documentation or laboratory question and a bounded answer.</li>
            <li><strong>Build an evidence map.</strong> We prioritize regulators, standards bodies, government scientific resources, original research, and peer-reviewed reviews.</li>
            <li><strong>Separate analytical claims.</strong> Identity, purity, assay, quantity, stability, sterility, and suitability are treated as distinct attributes.</li>
            <li><strong>State limitations.</strong> We identify what a method or document cannot establish and avoid extending results beyond the tested sample and lot.</li>
            <li><strong>Check links and dates.</strong> Sources, publication dates, update dates, internal links, and structured data are validated as part of the release build.</li>
          </ol>
        </section>
        <section>
          <h2>AI assistance</h2>
          <p>AI tools may assist with outlining, drafting, editing, and source discovery. We disclose that assistance on affected pages. AI-generated wording is not independent scientific evidence, a laboratory result, or expert review. Claims must remain traceable to the cited evidence, and pages do not claim a named scientific reviewer unless that review actually occurred.</p>
        </section>
        <section>
          <h2>Evidence and regulatory context</h2>
          <p>Regulatory documents may be cited because they clearly define analytical or documentation principles. A citation to FDA, ICH, eCFR, NIST, or another authority does not mean that every product discussed is an approved drug, that a specific regulation applies to the seller, or that the authority endorses the company. Each article states the scope in which a source is being used.</p>
        </section>
        <section>
          <h2>Updates and corrections</h2>
          <p>Material changes receive a new “updated” date; dates are not changed solely to make a page appear fresh. For a suspected factual error, broken source, undisclosed conflict, or mismatch with a batch document, email <a href="mailto:info@purehealthpeptidesshop.com?subject=Editorial%20correction">info@purehealthpeptidesshop.com</a> with the page address and supporting detail. We evaluate corrections against the underlying source and update the page when warranted.</p>
        </section>
        <aside>
          <h2>Need the evidence for a specific lot?</h2>
          <p>Educational articles explain how to read evidence. The <a href={appPath('/coa-library/')}>COA Library</a> is where you retrieve the available report for a specific product lot.</p>
        </aside>
      </div>
    </article>
  )
}
