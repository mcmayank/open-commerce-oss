/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BackToPagesLink } from './BackToPagesLink'

// Importing the module under test pulls the `@payloadcms/ui` client barrel
// in, and that barrel transitively imports a `.css` file vitest's default
// transform rejects outside jsdom/Vite CSS handling — same reason
// `EditRedirect.test.tsx` mocks the whole module rather than partially.
vi.mock('@payloadcms/ui', () => ({
  useConfig: () => ({ config: { routes: { admin: '/admin' } } }),
}))

afterEach(cleanup)

describe('BackToPagesLink', () => {
  it('derives the pages list href from useConfig rather than hardcoding it', () => {
    render(<BackToPagesLink />)
    const link = screen.getByRole('link', { name: /pages/i })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/admin/collections/pages')
  })

  it('defaults to the topbar link class so BuilderTopBar needs no className override', () => {
    render(<BackToPagesLink />)
    expect(screen.getByRole('link', { name: /pages/i }).className).toBe('pb-topbar__back')
  })

  it('accepts a className override for the pb-boot states, which render outside the topbar', () => {
    render(<BackToPagesLink className="pb-boot__back" />)
    expect(screen.getByRole('link', { name: /pages/i }).className).toBe('pb-boot__back')
  })
})
