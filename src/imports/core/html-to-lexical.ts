/**
 * Convert sanitised description HTML into the Lexical shape Payload stores.
 *
 * Scoped deliberately to the tag allowlist `sanitize-html.ts` produces, and no
 * further. That pairing is the reason this can be a small regex tokeniser
 * rather than a DOM: by the time HTML reaches here it has already been reduced
 * to a known set of elements with known attributes.
 *
 * The alternative was `@payloadcms/richtext-lexical`'s HTML converter, which
 * needs a DOM implementation — a jsdom dependency in the server bundle for one
 * field on one feature. The alternative to *that* was flattening every
 * description to plain text, which loses the lists and headings most product
 * copy is actually made of and makes an import look broken.
 *
 * Anything unrecognised degrades to its text, never to nothing.
 */

const BOLD = 1
const ITALIC = 2

type LexicalNode = Record<string, unknown>

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
}

const textNode = (text: string, format = 0): LexicalNode => ({
  type: 'text',
  text,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const paragraph = (children: LexicalNode[]): LexicalNode => ({
  type: 'paragraph',
  children: children.length ? children : [textNode('')],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

/** Inline markup inside one block: text, <strong>/<em>, <a>, <br>. */
function inlineNodes(html: string): LexicalNode[] {
  const out: LexicalNode[] = []
  // One pass over tags; everything between them is text.
  const pattern = /<(\/?)(strong|b|em|i|a|br)\b([^>]*)>|([^<]+)/gi
  let format = 0
  let link: { url: string; children: LexicalNode[] } | null = null

  const push = (node: LexicalNode) => {
    if (link) link.children.push(node)
    else out.push(node)
  }

  for (const match of html.matchAll(pattern)) {
    const [, closing, rawTag, attrs, text] = match

    if (text !== undefined) {
      const decoded = decodeEntities(text)
      if (decoded.trim() !== '' || decoded.includes(' ')) push(textNode(decoded, format))
      continue
    }

    const tag = rawTag.toLowerCase()
    if (tag === 'br') {
      push({ type: 'linebreak', version: 1 })
      continue
    }

    if (tag === 'a') {
      if (closing) {
        if (link) {
          out.push({
            type: 'link',
            fields: { url: link.url, newTab: false, linkType: 'custom' },
            children: link.children.length ? link.children : [textNode('')],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 2,
          })
          link = null
        }
      } else {
        const url = /href\s*=\s*"([^"]*)"/i.exec(attrs ?? '')?.[1]
        // The sanitiser already guarantees an absolute http(s) URL or no href
        // at all, so a missing one means the link was stripped — keep its text.
        if (url) link = { url, children: [] }
      }
      continue
    }

    const bit = tag === 'strong' || tag === 'b' ? BOLD : ITALIC
    format = closing ? format & ~bit : format | bit
  }

  // An unclosed <a> still has to contribute its text.
  if (link) out.push(...link.children)

  return out.filter((n) => n.type !== 'text' || (n.text as string) !== '')
}

/** Strip tags for cases where only the text survives. */
const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, '')).trim()

export function htmlToLexical(html: string): { root: LexicalNode } {
  const source = typeof html === 'string' ? html : ''
  const children: LexicalNode[] = []

  // Block-level split. Anything not matched here is treated as loose inline
  // content and collected into a paragraph.
  const blockPattern = /<(p|h[1-6]|ul|ol|blockquote|div|section)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi
  let cursor = 0

  const flushLoose = (upTo: number) => {
    const loose = source.slice(cursor, upTo)
    if (stripTags(loose) === '') return
    const nodes = inlineNodes(loose)
    if (nodes.length) children.push(paragraph(nodes))
  }

  for (const match of source.matchAll(blockPattern)) {
    flushLoose(match.index)
    cursor = match.index + match[0].length

    const tag = match[1].toLowerCase()
    const inner = match[2]

    if (tag === 'ul' || tag === 'ol') {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi)]
      const listItems = items.map((item, index) => ({
        type: 'listitem',
        value: index + 1,
        checked: undefined,
        children: inlineNodes(item[1]).length ? inlineNodes(item[1]) : [textNode('')],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      }))
      if (listItems.length === 0) continue
      children.push({
        type: 'list',
        tag,
        listType: tag === 'ol' ? 'number' : 'bullet',
        start: 1,
        children: listItems,
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      })
      continue
    }

    if (/^h[1-6]$/.test(tag)) {
      children.push({
        type: 'heading',
        tag,
        children: inlineNodes(inner),
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      })
      continue
    }

    // p, blockquote, div, section — all become paragraphs. An unknown block
    // keeping its text beats an unknown block disappearing.
    const nodes = inlineNodes(inner)
    if (nodes.length) children.push(paragraph(nodes))
  }

  flushLoose(source.length)

  return {
    root: {
      type: 'root',
      // Payload rejects a root with no children, so an empty description still
      // has to be one empty paragraph.
      children: children.length ? children : [paragraph([])],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}
