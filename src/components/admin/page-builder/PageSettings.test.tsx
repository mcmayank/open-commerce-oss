/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { PageSettings } from './PageSettings'

const setValueByPath: Record<string, ReturnType<typeof vi.fn>> = {}

function setValueFor(path: string) {
  if (!setValueByPath[path]) setValueByPath[path] = vi.fn()
  return setValueByPath[path]
}

vi.mock('@payloadcms/ui', () => ({
  useField: ({ path }: { path: string }) => ({ value: '', setValue: setValueFor(path) }),
}))

afterEach(() => {
  cleanup()
  for (const fn of Object.values(setValueByPath)) fn.mockReset()
})

describe('PageSettings', () => {
  it('renders the title input and calls its setValue when typed into', () => {
    render(<PageSettings />)

    const titleInput = screen.getByLabelText(/^title/i) as HTMLInputElement
    expect(titleInput).toBeTruthy()

    fireEvent.change(titleInput, { target: { value: 'About us' } })
    expect(setValueFor('title')).toHaveBeenCalledWith('About us')
  })

  it('renders the slug, SEO title, and SEO description inputs bound via useField', () => {
    render(<PageSettings />)

    const slugInput = screen.getByLabelText(/slug/i) as HTMLInputElement
    fireEvent.change(slugInput, { target: { value: 'about-us' } })
    expect(setValueFor('slug')).toHaveBeenCalledWith('about-us')

    const metaTitleInput = screen.getByLabelText(/seo title/i) as HTMLInputElement
    fireEvent.change(metaTitleInput, { target: { value: 'About Us | Store' } })
    expect(setValueFor('meta.title')).toHaveBeenCalledWith('About Us | Store')

    const metaDescriptionInput = screen.getByLabelText(/seo description/i) as HTMLTextAreaElement
    fireEvent.change(metaDescriptionInput, { target: { value: 'Learn more about us.' } })
    expect(setValueFor('meta.description')).toHaveBeenCalledWith('Learn more about us.')
  })

  it('toggles the noindex checkbox and calls its setValue', () => {
    render(<PageSettings />)

    const noindexCheckbox = screen.getByLabelText(/hide from search engines/i) as HTMLInputElement
    fireEvent.click(noindexCheckbox)
    expect(setValueFor('noindex')).toHaveBeenCalledWith(true)
  })
})
