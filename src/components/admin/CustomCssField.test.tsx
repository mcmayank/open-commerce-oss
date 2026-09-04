// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import CustomCssField from './CustomCssField'

const setValue = vi.fn()
let mockValue = ''
let mockCustomCss = false

vi.mock('@payloadcms/ui', () => ({
  useField: () => ({ value: mockValue, setValue }),
}))
vi.mock('./PremiumEntitlement/PremiumEntitlementClient', () => ({
  usePremiumEntitlement: () => ({ premiumSections: false, customCss: mockCustomCss }),
}))

afterEach(() => {
  cleanup()
  setValue.mockReset()
  mockValue = ''
  mockCustomCss = false
})

const field = {
  name: 'customCss',
  label: 'Custom CSS',
  admin: { description: 'Full reference: https://niblr.store/docs/custom-css' },
} as never

describe('CustomCssField', () => {
  it('is disabled when the tenant is not entitled', () => {
    mockCustomCss = false
    render(<CustomCssField field={field} path="customCss" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)
  })

  it('is editable when the tenant is entitled', () => {
    mockCustomCss = true
    render(<CustomCssField field={field} path="customCss" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.disabled).toBe(false)
  })

  it('shows existing CSS when not entitled (downgraded store still sees what is styling its site)', () => {
    mockCustomCss = false
    mockValue = 'a { color: red }'
    render(<CustomCssField field={field} path="customCss" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('a { color: red }')
  })

  it('shows existing CSS when entitled', () => {
    mockCustomCss = true
    mockValue = 'a { color: blue }'
    render(<CustomCssField field={field} path="customCss" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('a { color: blue }')
  })

  it('shows a Premium note linking to both the upgrade page and the docs', () => {
    mockCustomCss = false
    render(<CustomCssField field={field} path="customCss" />)
    expect(screen.getByText(/Premium/)).toBeTruthy()

    // Two links now, and the upgrade one is the point: this note told merchants
    // to upgrade for months while no upgrade page existed anywhere to click.
    const links = screen.getAllByRole('link') as HTMLAnchorElement[]
    expect(links).toHaveLength(2)
    expect(links.map((l) => l.getAttribute('href'))).toContain('/admin/settings/plan')
    expect(links.map((l) => l.href)).toContain('https://niblr.store/docs/custom-css')
  })

  it('shows no Premium note when entitled', () => {
    mockCustomCss = true
    render(<CustomCssField field={field} path="customCss" />)
    expect(screen.queryByText(/Premium feature/)).toBeNull()
  })

  it('lets an entitled tenant type into the field', () => {
    mockCustomCss = true
    render(<CustomCssField field={field} path="customCss" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'body { margin: 0 }' } })
    expect(setValue).toHaveBeenCalledWith('body { margin: 0 }')
  })

  // Regression guard for a Minor from review: a visually-adjacent <label> with no
  // htmlFor/id pairing looks fine but doesn't focus the textarea on click and
  // isn't announced by a screen reader as the field's name. Assert the actual
  // programmatic association, not just that a label with the right text exists —
  // a naive "label renders" test would pass even with the association missing.
  it('associates the label with the textarea so getByLabelText resolves it', () => {
    mockCustomCss = true
    render(<CustomCssField field={field} path="customCss" />)
    const textarea = screen.getByLabelText('Custom CSS') as HTMLTextAreaElement
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('keeps the same label/textarea association when locked', () => {
    mockCustomCss = false
    render(<CustomCssField field={field} path="customCss" />)
    const textarea = screen.getByLabelText('Custom CSS') as HTMLTextAreaElement
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea.disabled).toBe(true)
  })
})
