/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RichTextComponent } from './Component'

afterEach(cleanup)

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

/**
 * Guards the one subtle thing about `.store-prose` (src/app/(storefront)/globals.css):
 * its vertical-rhythm rules use `>` child combinators, so the class MUST sit on
 * the element the lexical nodes are direct children of — the wrapper the
 * renderer emits — not on an outer container. Putting it one level too high
 * silently costs every margin while still looking plausible in review; that is
 * exactly how this shipped wrong the first time.
 */
describe('RichText block prose wrapper', () => {
  it('puts store-prose on the element that directly parents the lexical nodes', () => {
    render(<RichTextComponent block={{ content: LEXICAL } as never} ctx={{} as never} />)

    const paragraph = screen.getByText('Hello prose')
    expect(paragraph).toBeTruthy()

    // The `>` rhythm rules in globals.css only match if the prose class sits on
    // the paragraph's direct parent.
    const parent = paragraph.parentElement
    expect(parent).toBeTruthy()
    expect(parent!.className).toContain('store-prose')

    // And the dead Tailwind class must be gone.
    expect(document.body.innerHTML).not.toContain('prose-gray')
    expect(parent!.className.split(/\s+/)).not.toContain('prose')
  })
})
