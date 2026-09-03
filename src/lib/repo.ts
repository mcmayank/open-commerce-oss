/**
 * Single source of truth for how the site talks about the source repository.
 *
 * The repo is not public yet: `github.com/mcmayank/open-commerce` returns 404,
 * and until 25 Jul 2026 thirteen places linked to it anyway — including four
 * Trust cards sitting under the heading "You can check every claim on this page
 * yourself." A claim that 404s is worse than no claim.
 *
 * So every "read the source" affordance routes through `repoCtaHref()`. While
 * `REPO_IS_PUBLIC` is false it points at /open-source, which states the licence
 * (true and checkable) and explains that the repo is being prepared. When the
 * security scrub of the commit history lands and the repo goes public, flip the
 * one boolean below and every CTA on the site returns to GitHub — no other edit.
 *
 * See docs/niblr-brand-principles.md, "Open-source claim, current status":
 * claim the MIT licence, never "read and fork every line" or "browse the repo".
 */

/** Canonical repo URL. Correct even while private — this is where it will live. */
export const REPO_URL = 'https://github.com/mcmayank/open-commerce'

/**
 * Whether `REPO_URL` actually resolves for the public.
 *
 * FLIP THIS TO `true` ONLY once the repo is genuinely public and anonymous.
 * Verify by loading REPO_URL in a logged-out browser — being able to see it
 * while signed in as the owner proves nothing.
 */
export const REPO_IS_PUBLIC = false

/** The public issues URL. Only meaningful when the repo is public. */
export const REPO_ISSUES_URL = `${REPO_URL}/issues/new`

/** Merged-PR list, used by the changelog as "see the commits behind this". */
export const REPO_MERGED_PRS_URL = `${REPO_URL}/pulls?q=is%3Apr+is%3Amerged`

/** Where the /open-source explainer lives while the repo is private. */
export const OPEN_SOURCE_PATH = '/open-source'

/**
 * Destination for any "read the source" / "browse the repo" call to action.
 * Private → the /open-source explainer. Public → GitHub.
 */
export function repoCtaHref(): string {
  return REPO_IS_PUBLIC ? REPO_URL : OPEN_SOURCE_PATH
}

/**
 * Label for that CTA. Never promises browsing while the repo is private.
 * Callers that need their own wording should still gate on `REPO_IS_PUBLIC`.
 */
export function repoCtaLabel(): string {
  return REPO_IS_PUBLIC ? 'Read the source' : 'How open source works here'
}

/**
 * True when a link would leave the site. Callers use this to pick `<a>` vs
 * next/link, since /open-source is internal and GitHub is not.
 */
export function repoCtaIsExternal(): boolean {
  return REPO_IS_PUBLIC
}
