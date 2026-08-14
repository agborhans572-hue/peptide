import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoaCategoryPage } from './CoaLibraryPages.jsx'

describe('COA category delivery', () => {
  beforeEach(() => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      id: `vials-${index + 1}`,
      product: `Research Product ${index + 1}`,
      batchCount: 1,
      batchIds: [`BATCH-${index + 1}`],
    }))
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/index.json')) return Response.json({ heading: 'Vial COA library', items })
      return Response.json({ batches: [{ id: 'BATCH-1', href: 'https://example.test/coa.pdf' }] })
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('paginates at 24 and fetches batch links only when a product is expanded', async () => {
    render(<CoaCategoryPage category="vials" />)
    await screen.findByRole('heading', { name: 'Vial COA library' })
    expect(screen.getAllByRole('article')).toHaveLength(24)
    expect(fetch).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'LOAD MORE RESULTS' }))
    expect(screen.getAllByRole('article')).toHaveLength(30)

    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'View 1 batch' })[0]))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect((await screen.findByRole('link', { name: 'BATCH-1' })).getAttribute('href')).toBe('https://example.test/coa.pdf')
  })
})
