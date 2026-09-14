import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorialStandardsPage, EducationArticlePage, LearningCenterPage } from './EducationPages.jsx'
import { publishedEducationArticles, scheduledEducationArticles } from './educationArticles.js'

describe('laboratory education library', () => {
  it('publishes two guides and lists the next six on the editorial schedule', () => {
    render(<LearningCenterPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Evidence-led guidance for research materials' })).toBeTruthy()
    for (const article of publishedEducationArticles) {
      expect(screen.getByRole('link', { name: article.title }).getAttribute('href')).toBe(`/news/${article.slug}/`)
    }
    for (const article of scheduledEducationArticles) expect(screen.getByText(article.title)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Read our editorial standards/i }).getAttribute('href')).toBe('/editorial-standards/')
  })

  it('renders an accountable byline, limitations, sources, and internal resources', () => {
    const article = publishedEducationArticles[0]
    render(<EducationArticlePage slug={article.slug} />)
    expect(screen.getByRole('heading', { level: 1, name: article.title })).toBeTruthy()
    expect(screen.getByText(/Written by/i).textContent).toContain('Pure Health Peptides Editorial Team')
    expect(screen.getByText(/does not provide instructions for human or veterinary use/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Sources and further reading' })).toBeTruthy()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(article.sources.length)
    expect(screen.getByRole('link', { name: /Search the batch COA library/i }).getAttribute('href')).toBe('/coa-library/')
  })

  it('discloses the editorial and AI-assistance policy without claiming a reviewer', () => {
    render(<EditorialStandardsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Editorial standards for laboratory education' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'AI assistance' })).toBeTruthy()
    expect(screen.getByText(/do not invent author biographies/i)).toBeTruthy()
    expect(screen.getByText(/do not claim a named scientific reviewer/i)).toBeTruthy()
  })

  it('keeps scheduled drafts off public article pages', () => {
    render(<EducationArticlePage slug={scheduledEducationArticles[0].slug} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Guide not found' })).toBeTruthy()
  })
})
