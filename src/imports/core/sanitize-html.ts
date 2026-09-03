/**
 * Sanitise third-party product description HTML.
 *
 * A merchant's old store is not a trusted source. Its `body_html` is arbitrary
 * markup written by whoever ran that store — or by whoever compromised it — and
 * it ends up rendering on a `*.niblr.store` subdomain, which makes an unfiltered
 * import a stored-XSS vector carrying our own domain name.
 *
 * This is an ALLOWLIST, not a blocklist: an element that is not explicitly known
 * is unwrapped and an attribute that is not explicitly known is dropped. A
 * blocklist only stops the attacks you thought of.
 *
 * Scope: this is the boundary filter, not the last line of defence. Descriptions
 * are converted to Lexical before they reach a storefront, which independently
 * discards anything it has no node for. The review screen must render this as
 * TEXT, never with `dangerouslySetInnerHTML`.
 */

/**
 * Elements whose contents are executable or stylesheet source. If one of these
 * is left unclosed, everything after it is still part of that element as far as
 * a browser is concerned, so an unterminated one is dropped to end of input.
 */
const CODE_CONTENT = ['script', 'style', 'template', 'noscript', 'title']

/**
 * Elements that must not survive, but whose inner text is inert. Removing the
 * tags is enough — an unclosed one must NOT eat the rest of the description.
 */
const INERT_ELEMENTS = ['iframe', 'object', 'embed', 'svg', 'math', 'form', 'link', 'meta', 'base']

/** Elements kept as-is. Everything else is unwrapped, keeping its text. */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'small',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
])

/** Attributes kept, per element. Everything else is dropped, including `style`. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'title']),
}

/** Only these schemes may appear in a kept URL attribute. */
const SAFE_URL = /^https?:\/\//i

/**
 * Strip the characters an attacker inserts to break up a scheme name —
 * `java&#9;script:` and `java\tscript:` both parse as `javascript:` in a browser
 * but survive a naive `startsWith` check.
 */
function normalizeUrl(value: string): string {
  return value
    .replace(/&#(\d+);?/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);?/gi, (_m, code) => String.fromCharCode(parseInt(code, 16)))
    // Drop every control character and space. A browser ignores these inside a
    // scheme name, so a tab in `java<TAB>script:` and the entity in
    // `java&#9;script:` both still execute. Filtered by char code rather than a
    // regex range, because that range is literal control bytes in source and
    // does not survive being copied around.
    .split('')
    .filter((ch) => ch.charCodeAt(0) > 0x20)
    .join('')
}

function isSafeUrl(value: string): boolean {
  return SAFE_URL.test(normalizeUrl(value))
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Repeat a replacement until it stops changing the string. */
function stripUntilStable(html: string, pattern: RegExp): string {
  let previous: string
  let current = html
  let guard = 0
  do {
    previous = current
    current = current.replace(pattern, '')
    // `<scr<script>ipt>` reassembles into a live tag when the inner match is
    // removed, so one pass is not enough. The guard stops a pathological input
    // from looping forever.
  } while (current !== previous && ++guard < 20)
  return current
}

const ATTR = /([a-zA-Z_:][-\w:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/g

function rebuildAttributes(tag: string, rawAttrs: string): string {
  const allowed = ALLOWED_ATTRS[tag]
  if (!allowed) return ''

  const kept: string[] = []
  for (const match of rawAttrs.matchAll(ATTR)) {
    const name = match[1].toLowerCase()
    if (!allowed.has(name)) continue

    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    // URL-bearing attributes must be an absolute http(s) URL. Relative and
    // protocol-relative URLs resolve against OUR origin once imported, which is
    // never what the source meant.
    if ((name === 'href' || name === 'src') && !isSafeUrl(value)) continue

    kept.push(`${name}="${escapeAttr(value)}"`)
  }

  return kept.length ? ` ${kept.join(' ')}` : ''
}

export function sanitizeDescriptionHtml(html: string): string {
  if (typeof html !== 'string' || html === '') return ''

  let out = html

  // 1. Comments first — they can hide markup that reassembles once removed.
  out = stripUntilStable(out, /<!--[\s\S]*?-->/g)
  out = out.replace(/<!--[\s\S]*$/, '') // unterminated comment

  // 2a. Executable content: matched pairs first, then anything left unclosed is
  //     removed to end of input. Order matters — stripping the bare `<script>`
  //     tag first would leave `alert(1)` sitting in the description as text.
  for (const tag of CODE_CONTENT) {
    out = stripUntilStable(out, new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'))
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*$`, 'i'), '')
  }

  // 2b. Inert elements: drop the element and its contents where it is closed,
  //     otherwise just the tag. Never to end of input — a stray `<svg>` must not
  //     swallow the rest of a legitimate description.
  for (const tag of INERT_ELEMENTS) {
    out = stripUntilStable(out, new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'))
    out = stripUntilStable(out, new RegExp(`<\\/?${tag}\\b[^>]*\\/?>`, 'gi'))
  }

  // 3. Every remaining `<...>` in ONE pass: rebuilt if allowed, unwrapped if
  //    not, dropped if malformed. It has to be a single pass — a second sweep
  //    for "leftovers" cannot tell a tag this function just emitted from one it
  //    has never inspected, and would strip its own output.
  //
  //    The alternation tolerates `>` inside a quoted attribute value, and the
  //    trailing branch catches an unterminated `<` at end of input.
  out = out.replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>|<[^>]*$/g, (match) => {
    const parsed = /^<\s*(\/?)\s*([a-zA-Z][-\w]*)([\s\S]*?)\/?\s*>?$/.exec(match)
    if (!parsed) return '' // a stray `<`, or something that is not a tag at all

    const [, slash, name, rawAttrs] = parsed
    const tag = name.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return '' // unwrap: the text between tags stays
    if (slash) return `</${tag}>`
    return `<${tag}${rebuildAttributes(tag, rawAttrs)}>`
  })

  return out
}
