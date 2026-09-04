/**
 * Merchant-supplied link destinations, allowlisted by scheme.
 *
 * Default-deny, matching the posture src/lib/custom-css.ts already takes on
 * merchant URLs: anything not recognisably safe is refused rather than
 * analysed. An allowlist is what makes case and encoding tricks fail closed —
 * `JaVaScRiPt:` does not match an allowed scheme, so it is rejected without
 * needing to be anticipated.
 *
 * Returns undefined for anything unusable, so callers degrade to plain text
 * rather than emitting a dead or dangerous anchor.
 */
const ALLOWED_SCHEME = /^(?:https?|mailto|tel):/i

export function safeHref(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined

  // Strip control characters (tabs, newlines, carriage returns, and the rest
  // of the C0/DEL range) BEFORE testing. Browsers ignore them inside a
  // scheme, so `java\tscript:` navigates as `javascript:` — testing the raw
  // string would let it through. The range below is deliberately the C0
  // control characters plus DEL.
  const href = raw.replace(/[\x00-\x1f\x7f]/g, '').trim()
  if (!href) return undefined

  // Same-document, root-relative and query-relative links cannot carry a
  // scheme, so they are safe by construction. This also covers protocol-
  // relative `//host`, which resolves to the page's own scheme.
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('?')) return href

  // A bare `example.com` has no scheme and is not relative, so it is refused
  // here — that is default-deny working as intended, not a bug to "fix" by
  // falling back to prefixing `https://` onto the string. The authoring form
  // added later is where a merchant is told to write a full URL.
  return ALLOWED_SCHEME.test(href) ? href : undefined
}
