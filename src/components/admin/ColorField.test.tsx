// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ColorField, { INHERITS } from './ColorField'
import { DEFAULT_TOKENS, resolveTokens } from '@/lib/theme-tokens'

const setValue = vi.fn()

vi.mock('@payloadcms/ui', () => ({
  useField: () => ({ value: mockValue, setValue }),
}))
vi.mock('./useThemePreset', () => ({
  useThemePreset: () => ({ tokens: { colorAccent: '#7a1f3d' }, loading: false }),
}))

let mockValue = ''

afterEach(() => {
  cleanup()
  setValue.mockReset()
  mockValue = ''
})

const field = { name: 'accentColor', label: 'Accent colour' } as never

describe('ColorField', () => {
  it('shows the inherited theme colour when empty', () => {
    mockValue = ''
    render(<ColorField field={field} path="theme.accentColor" />)
    expect(screen.getByText(/From your theme/).textContent).toContain('#7a1f3d')
  })

  it('offers no reset control while inheriting', () => {
    mockValue = ''
    render(<ColorField field={field} path="theme.accentColor" />)
    expect(screen.queryByText('Reset to theme')).toBeNull()
  })

  it('clears back to inheritance when reset is clicked', () => {
    mockValue = '#00ff00'
    render(<ColorField field={field} path="theme.accentColor" />)
    fireEvent.click(screen.getByText('Reset to theme'))
    expect(setValue).toHaveBeenCalledWith('')
  })

  // The tests above mock useThemePreset, so they pass no matter what
  // resolveTokens does. This one exercises the REAL resolver: INHERITS is a
  // second copy of resolveTokens' field→token mapping, and nothing else pins
  // the two together. `backgroundColor → colorSurface` in particular is
  // flagged in the spec as semantically wrong and likely to move.
  it('maps each field to the token resolveTokens actually writes', () => {
    for (const [fieldName, tokenKey] of Object.entries(INHERITS)) {
      expect(
        resolveTokens(DEFAULT_TOKENS, { [fieldName]: '#abcdef' })[tokenKey],
        `INHERITS.${fieldName} claims ${tokenKey}, but resolveTokens does not write it`,
      ).toBe('#abcdef')
    }
  })

  it('marks an inherited swatch as inherited and a chosen one as chosen', () => {
    mockValue = ''
    const { unmount } = render(<ColorField field={field} path="theme.accentColor" />)
    const inheriting = screen.getByLabelText(/swatch$/i) as HTMLInputElement
    expect(inheriting.style.border).toContain('dashed')
    unmount()

    mockValue = '#00ff00'
    render(<ColorField field={field} path="theme.accentColor" />)
    const chosen = screen.getByLabelText(/swatch$/i) as HTMLInputElement
    expect(chosen.style.border).not.toContain('dashed')
  })
})
