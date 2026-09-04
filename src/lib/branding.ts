import type { Store } from '@/store-loader'

export type BrandingStore = Pick<Store, 'showsPlatformBranding'>

/**
 * Whether a storefront shows the "Powered by Niblr" line. The decision is made
 * where the store is loaded — hosted keys it on billing state
 * (src/hosted/lib/branding.ts); the OSS build never shows it — and travels on
 * the Store, so this stays pure and synchronous for every footer.
 * No store (a page rendered without one) shows the line.
 */
export function showsNiblrBranding(store: BrandingStore | null | undefined): boolean {
  if (!store) return true
  return store.showsPlatformBranding
}
