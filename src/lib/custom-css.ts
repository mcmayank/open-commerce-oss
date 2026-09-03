import postcss, { type Root } from 'postcss'

/**
 * Merchant-authored CSS: the single validation choke point.
 *
 * Mirrors src/lib/theme-customizations.ts — keep what is valid, drop what is
 * not, cap the size so a direct API write cannot bloat the row. The one
 * difference is that malformed input throws rather than being dropped: broken
 * CSS is a mistake the merchant must see at save time, not silently discarded.
 *
 * Parsing with postcss, rather than pattern-matching the raw text, is what
 * keeps a construct from hiding inside a string or a comment: postcss's
 * tokenizer already separates those out before any rule below ever sees an
 * at-rule name or a declaration value. What postcss does NOT do is decode CSS
 * escapes — it hands back `\75 rl(…)` verbatim where a browser tokenizes it as
 * `url(…)` — so declaration text is treated as undecoded and handled
 * default-deny on two axes:
 *
 * 1. **URL-bearing functions.** A URL argument is kept only when it is
 *    unambiguously a root-relative path, a data: URI, or a same-document
 *    #fragment, and refused otherwise, rather than trying to detect every way
 *    it could be disguised. `url()` is not the only such function: `image-set()`
 *    (and its `-webkit-` spelling), `src()` in `@font-face`, and `image()` all
 *    take a `<string>` that IS a URL, so they run through the same predicate.
 * 2. **Escapes.** Any backslash outside a quoted string refuses the whole
 *    declaration, and so does one in a property name. This is what closes the
 *    escaped-function-name hole: the refusals in `isSafeUrlArg` only apply
 *    inside an argument the scan has already located, and an escape in the
 *    function *name* means the scan never locates the argument at all. Refusing
 *    is cheaper and safer than decoding, and an escape outside a string has no
 *    legitimate use in merchant CSS. Escapes inside a quoted string are kept —
 *    `content: "\2014"` is ordinary CSS and issues no request — except where
 *    that string is itself a URL argument, which `isSafeUrlArg` still refuses.
 */

export const MAX_CUSTOM_CSS_BYTES = 32 * 1024

export class CustomCssError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CustomCssError'
  }
}

/** Matches each url(...) construct in a declaration value, capturing its argument. */
const URL_TOKEN = /url\(\s*([^)]*?)\s*\)/gi

/** Matches every quoted string in a value, so string content can be excluded from a scan. */
const QUOTED_STRING = /"[^"]*"|'[^']*'/g

/**
 * CSS functions other than url() whose arguments are URLs, so they need the
 * same default-deny treatment. Each takes a `<string>` that a browser resolves
 * as a URL — there is no url() token to key on.
 *
 * - `image-set()` / `-webkit-image-set()` — css-images-4; the `<image-set-option>`
 *   grammar accepts a bare `<string>` alongside `<image>`. Every shipping browser
 *   still accepts the prefixed spelling, so both are covered.
 * - `src()` — css-values-4's typed URL function, the modern spelling of `url()`
 *   in an `@font-face` `src` descriptor.
 * - `image()` — css-images-4, whose first argument may be a `<string>` URL. No
 *   browser ships it today; it costs nothing to refuse it now rather than the
 *   day one does.
 *
 * Deliberately NOT listed, having been checked:
 * - `cross-fade()` / `-webkit-cross-fade()` take `<image>`s, which means a nested
 *   `url()` or `image-set()` — both already scanned in place, confirmed by probe.
 * - `element()` / `-moz-element()` take a same-document element id and issue no
 *   request, exactly like `url(#fragment)`.
 * - `paint()` names a worklet that can only be registered from JavaScript via
 *   `CSS.paintWorklet.addModule()`; CSS cannot make it fetch anything.
 * - `@import` is removed wholesale below, before any of this runs.
 */
const STRING_URL_FUNCTIONS = ['-webkit-image-set', 'image-set', 'image', 'src']

/**
 * Matches a URL-taking function call from the list above and captures its raw
 * argument text. The leading `(?:^|[^\w-])` is an identifier boundary, so
 * `-webkit-image-set(` is matched by its own entry rather than half-matched by
 * `image-set`, and `image-set(` is never half-matched by `image`.
 *
 * The argument capture spans one level of nested parens, so the ordinary
 * `image-set(url(/a.png) 1x, url(/b.png) 2x)` is captured whole instead of
 * being cut off at the first url()'s closing paren. Deeper nesting than that
 * leaves an unbalanced paren in the capture, which `areSafeStringUrlArgs`
 * refuses. The two alternatives consume disjoint first characters, so the
 * nested quantifier cannot backtrack exponentially.
 */
const STRING_URL_TOKEN = new RegExp(
  `(?:^|[^\\w-])(?:${STRING_URL_FUNCTIONS.join('|')})\\(((?:[^()]|\\([^()]*\\))*)\\)`,
  'gi',
)

/**
 * A url() argument is kept only if it is unambiguously safe — everything else
 * is refused rather than analysed. This is deliberately default-deny: a CSS
 * hex escape (backslash followed by a hex code, e.g. the escape for "h") or a
 * comment spliced into the middle of the argument both resolve to an external
 * URL in a browser without ever looking like one to a pattern that only
 * searches for "http" or "//". Refusing anything containing a backslash, a
 * comment marker, or an unescaped paren closes that class of obfuscation
 * *within an argument this scan has already located* — it does nothing about an
 * escape in the function NAME, which stops the argument being located at all;
 * `hasEscapeOutsideString` is what covers that, and the two together are what
 * make the claim hold. A paren is also
 * refused outright (not just when nested) because URL_TOKEN's own scan stops
 * at the first ")", so a paren inside the argument would otherwise let text
 * after it hide from this check entirely.
 *
 * Every branch below either explicitly allows (data:, a root-relative path
 * anchored start-to-end, or a bare #fragment anchored start-to-end) or falls
 * through to the final `return false` — there is no path that returns true
 * without matching one of those three shapes exactly.
 */
function isSafeUrlArg(rawArg: string): boolean {
  const unquoted =
    (rawArg.startsWith('"') && rawArg.endsWith('"')) || (rawArg.startsWith("'") && rawArg.endsWith("'"))
      ? rawArg.slice(1, -1)
      : rawArg

  if (unquoted.includes('\\')) return false
  if (unquoted.includes('/*') || unquoted.includes('*/')) return false
  if (unquoted.includes('(') || unquoted.includes(')')) return false

  if (/^data:/i.test(unquoted)) return true
  // Root-relative: exactly one leading slash (two would be protocol-relative),
  // anchored to the end so nothing after the prefix escapes this check.
  if (/^\/(?!\/)[\s\S]*$/.test(unquoted)) return true
  // Same-document fragment reference (filter: url(#blur), fill: url(#gradient)):
  // a lone #id issues no request, so it cannot leak to another origin. Anchored
  // start-to-end so "https://evil.test/x#frag" — which merely contains a "#" —
  // does not qualify.
  if (/^#[A-Za-z_][\w-]*$/.test(unquoted)) return true

  return false
}

/**
 * Checks the argument list of a STRING_URL_FUNCTIONS call.
 *
 * Nested `url()` arguments — `image-set(url(/a.png) 1x, url(/b.png) 2x)` is the
 * ordinary way to write one — are validated in place by the url() scan, so they
 * are blanked out first and judged there rather than twice. Anything still
 * carrying a paren after that is a nested construct whose end this non-nesting
 * scan cannot see, and is refused rather than guessed at. Every remaining
 * quoted string is a URL by this grammar, so each goes through the same
 * predicate a url() argument does.
 */
function areSafeStringUrlArgs(rawArgs: string): boolean {
  const rest = rawArgs.replace(URL_TOKEN, ' ')
  if (rest.includes('(') || rest.includes(')')) return false
  return (rest.match(QUOTED_STRING) ?? []).every((str) => isSafeUrlArg(str))
}

/** True if any URL-bearing function in the value is not on the safe allowlist above. */
function hasUnsafeUrl(value: string): boolean {
  for (const match of value.matchAll(URL_TOKEN)) {
    if (!isSafeUrlArg(match[1].trim())) return true
  }
  for (const match of value.matchAll(STRING_URL_TOKEN)) {
    if (!areSafeStringUrlArgs(match[1])) return true
  }
  return false
}

/**
 * True if a CSS escape sits anywhere outside a quoted string. Such an escape
 * can disguise a function name (`\75 rl(…)`) or a keyword (`position: \66 ixed`)
 * from every other check here, and postcss hands the text over undecoded.
 */
function hasEscapeOutsideString(value: string): boolean {
  return value.replace(QUOTED_STRING, '').includes('\\')
}

/** Constructs stripped from every declaration, with the reason they are unsafe. */
function isUnsafeDecl(prop: string, value: string): boolean {
  // An escaped property name defeats the prop comparisons below the same way an
  // escaped function name defeats the value scan: `\70 osition` is `position`.
  if (prop.includes('\\')) return true
  // Undecodable text that could be hiding any of the constructs below.
  if (hasEscapeOutsideString(value)) return true
  // Fires a network request on render, disclosing every visitor to a third party
  // — or hides that it does, via an escape or comment url() doesn't decode here.
  if (hasUnsafeUrl(value)) return true
  // The full-viewport overlay shape: fake UI drawn over storefront content.
  if (prop === 'position' && value.trim().toLowerCase() === 'fixed') return true
  return false
}

/**
 * Validate and clean merchant CSS for storage. Returns '' for absent input.
 * Throws CustomCssError when the input is malformed or over the size cap.
 */
export function sanitizeCustomCss(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const css = raw.trim()
  if (css === '') return ''

  if (Buffer.byteLength(css, 'utf8') > MAX_CUSTOM_CSS_BYTES) {
    throw new CustomCssError(
      `Custom CSS is larger than the ${Math.floor(MAX_CUSTOM_CSS_BYTES / 1024)}KB limit.`,
    )
  }

  let root: Root
  try {
    root = postcss.parse(css)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'could not be parsed'
    throw new CustomCssError(`Custom CSS could not be parsed: ${reason}`)
  }

  // @import fetches a stylesheet we never inspect, bypassing every rule below.
  // Matched case-insensitively: postcss preserves the author's casing verbatim,
  // so a bare string filter lets @IMPORT / @Import sail through untouched.
  root.walkAtRules(/^import$/i, (rule) => {
    rule.remove()
  })
  root.walkDecls((decl) => {
    if (isUnsafeDecl(decl.prop.toLowerCase(), decl.value)) decl.remove()
  })

  return root.toString()
}
