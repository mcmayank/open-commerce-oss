// Slug format: 2-60 chars, lowercase alphanumerics and single hyphens, no leading/trailing hyphen.
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/

export function isValidSlugFormat(slug: string): boolean {
  if (slug.length < 2) return false
  return SLUG_PATTERN.test(slug)
}

/**
 * `slugify` for callers that must not produce an invalid slug.
 *
 * `slugify` is a pure transform and will happily return values the server
 * rejects — `'A'` becomes `'a'` (under the 2-char minimum) and `'!!!'` becomes
 * `''`. Auto-derivation needs to know the difference, so this returns null
 * rather than a value that would fail validation on save.
 */
export function safeSlugify(input: string): string | null {
  const slug = slugify(input)
  return isValidSlugFormat(slug) ? slug : null
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}
