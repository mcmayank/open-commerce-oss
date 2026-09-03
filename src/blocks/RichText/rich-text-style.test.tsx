/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RichTextComponent } from './Component'

afterEach(cleanup)

// Minimal valid lexical doc — mirrors the fixture in `Component.test.tsx` so this
// directory doesn't accumulate two divergent hand-rolled lexical shapes. The
// component early-returns null for falsy `content` (see Component.tsx), so the
// section wrapper only renders through this non-empty path.
const LEXICAL = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          { text: 'Hello prose', type: 'text', version: 1, format: 0, style: '', mode: 'normal', detail: 0 },
        ],
      },
    ],
  },
}

describe('RichText --bs-* wiring', () => {
  it('the section wrapper reads --bs-section-* vars with current-value fallbacks', () => {
    const { container } = render(
      <RichTextComponent block={{ content: LEXICAL } as any} ctx={{} as any} /> as any,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('var(--bs-section-pad,3rem)')
    expect(wrapper.className).toContain('var(--bs-section-width,48rem)')
  })

  it('renders nothing when content is empty (guard preserved)', () => {
    const { container } = render(
      <RichTextComponent block={{ content: null } as any} ctx={{} as any} /> as any,
    )
    expect(container.firstElementChild).toBeNull()
  })
})
