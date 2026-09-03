import { describe, it, expect } from 'vitest'
import { htmlToLexical } from './html-to-lexical'

type Node = { type: string; tag?: string; children?: Node[]; text?: string; format?: number | string }

const root = (html: string) => htmlToLexical(html).root as unknown as Node
const blocks = (html: string) => root(html).children ?? []
const textOf = (node: Node): string =>
  node.text ?? (node.children ?? []).map(textOf).join('')

describe('htmlToLexical', () => {
  it('produces a valid empty document for empty input', () => {
    const doc = root('')
    expect(doc.type).toBe('root')
    expect(doc.children).toHaveLength(1)
    expect(doc.children?.[0].type).toBe('paragraph')
  })

  it('turns paragraphs into paragraph nodes', () => {
    const out = blocks('<p>One.</p><p>Two.</p>')

    expect(out).toHaveLength(2)
    expect(out.every((b) => b.type === 'paragraph')).toBe(true)
    expect(textOf(out[0])).toBe('One.')
    expect(textOf(out[1])).toBe('Two.')
  })

  it('keeps bare text that is not wrapped in a block', () => {
    const out = blocks('Just words.')

    expect(out).toHaveLength(1)
    expect(textOf(out[0])).toBe('Just words.')
  })

  it('maps headings to heading nodes with their level', () => {
    const out = blocks('<h2>Care</h2>')

    expect(out[0].type).toBe('heading')
    expect(out[0].tag).toBe('h2')
    expect(textOf(out[0])).toBe('Care')
  })

  // Lists are the structure most product descriptions actually use; flattening
  // them into one paragraph is what makes an import look broken.
  it('maps an unordered list to a list with one item per li', () => {
    const out = blocks('<ul><li>Leak proof</li><li>BPA free</li></ul>')

    expect(out[0].type).toBe('list')
    expect(out[0].tag).toBe('ul')
    expect(out[0].children).toHaveLength(2)
    expect(out[0].children?.[0].type).toBe('listitem')
    expect(textOf(out[0].children![0])).toBe('Leak proof')
  })

  it('distinguishes ordered from unordered lists', () => {
    expect(blocks('<ol><li>First</li></ol>')[0].tag).toBe('ol')
  })

  it('marks bold and italic on the text node rather than dropping them', () => {
    const out = blocks('<p>A <strong>great</strong> and <em>light</em> bottle.</p>')
    const children = out[0].children ?? []

    const bold = children.find((c) => c.text === 'great')
    const italic = children.find((c) => c.text === 'light')
    expect(bold?.format).toBe(1)
    expect(italic?.format).toBe(2)
    expect(textOf(out[0])).toBe('A great and light bottle.')
  })

  it('keeps a link as a link node carrying its url', () => {
    const out = blocks('<p>See <a href="https://example.com/x">docs</a>.</p>')
    const link = (out[0].children ?? []).find((c) => c.type === 'link') as
      | (Node & { fields?: { url?: string } })
      | undefined

    expect(link).toBeTruthy()
    expect(link?.fields?.url).toBe('https://example.com/x')
    expect(textOf(link!)).toBe('docs')
  })

  it('treats <br> as a line break rather than losing it', () => {
    const out = blocks('<p>One<br>Two</p>')
    expect((out[0].children ?? []).some((c) => c.type === 'linebreak')).toBe(true)
  })

  it('decodes entities so text reads correctly', () => {
    expect(textOf(blocks('<p>Tea &amp; coffee &mdash; 300ml</p>')[0])).toBe(
      'Tea & coffee — 300ml',
    )
  })

  it('never emits an empty root, which Payload rejects', () => {
    for (const html of ['', '   ', '<div></div>', '<p></p>']) {
      const doc = root(html)
      expect((doc.children ?? []).length).toBeGreaterThan(0)
    }
  })

  it('flattens an unknown block to a paragraph rather than dropping its text', () => {
    const out = blocks('<section>Kept</section>')
    expect(textOf(out[0])).toBe('Kept')
  })
})
