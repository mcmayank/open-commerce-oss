/**
 * Single source of truth for how the site talks about the source repository.
 *
 * The public repository is the exported single-store build
 * (github.com/mcmayank/open-commerce-oss, public since 3 Sep 2026, first
 * release v1.0.0-oss). It is produced from the private repo on every release
 * tag by .github/workflows/export-oss.yml as one squashed commit; the
 * multi-tenant hosting layer, billing and platform operator tools are not in
 * it. Until 25 Jul 2026 thirteen places linked to the private repo, which
 * 404ed for the public — a claim that 404s is worse than no claim — so every
 * "read the source" affordance still routes through `repoCtaHref()`, and
 * `REPO_IS_PUBLIC` stays the one switch should the repo ever need to close.
 *
 * See docs/niblr-brand-principles.md, "Open-source claim, current status":
 * claim the licence and the single-store build, never that every line the
 * hosted service runs is in the public repo.
 */

/** The public repository: the exported single-store build. */
export const REPO_URL = 'https://github.com/mcmayank/open-commerce-oss'

/**
 * Whether `REPO_URL` actually resolves for the public.
 *
 * Only `true` while the repo is genuinely public and anonymous. Verified on
 * 3 Sep 2026 with an unauthenticated request, not from the owner's session.
 */
export const REPO_IS_PUBLIC = true

/** The public repo's CI workflow (runs on every release push) and its status badge. */
export const REPO_CI_URL = `${REPO_URL}/actions/workflows/ci.yml`
export const REPO_CI_BADGE_URL = `${REPO_CI_URL}/badge.svg`

/** The public issues URL. Only meaningful when the repo is public. */
export const REPO_ISSUES_URL = `${REPO_URL}/issues/new`

/**
 * Commit list, used by the changelog as "see the commits behind this". The
 * public repo receives one squashed commit per release, so there are no pull
 * requests there to point at.
 */
export const REPO_COMMITS_URL = `${REPO_URL}/commits/main`

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
