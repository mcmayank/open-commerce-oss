import { cookies, draftMode } from 'next/headers'
import type { Store } from '@/store-loader'
import { getStorefrontThemeBySlug, type StorefrontTheme } from '@/themes'
import { PREVIEW_TENANT_COOKIE, PREVIEW_THEME_COOKIE, resolvePreviewTheme } from './preview'

/**
 * Resolve which storefront theme a request should render, honoring an active
 * "try-on" preview. Every theme-dispatching storefront route calls this instead
 * of getStorefrontTheme(store) directly.
 *
 * Cache-safety: reading draftMode().isEnabled is safe during prerender; the
 * preview cookies are only read inside resolvePreviewTheme when draft mode is
 * on, so a normal visitor's request never touches cookies() and the route stays
 * statically cacheable. `previewSlug` is non-null only during an authorized,
 * tenant-matched preview session — routes use it to show the preview banner.
 */
export async function resolveActiveTheme(
  store: Pick<Store, 'id' | 'storefrontTheme'>,
): Promise<{ theme: StorefrontTheme | null; previewSlug: string | null }> {
  const { isEnabled: draftEnabled } = await draftMode()
  const previewSlug = await resolvePreviewTheme({
    draftEnabled,
    hostTenantId: store.id,
    readTenantCookie: async () => (await cookies()).get(PREVIEW_TENANT_COOKIE)?.value,
    readThemeCookie: async () => (await cookies()).get(PREVIEW_THEME_COOKIE)?.value,
  })
  const activeSlug = previewSlug ?? store.storefrontTheme ?? null
  return { theme: getStorefrontThemeBySlug(activeSlug), previewSlug }
}
