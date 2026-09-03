/**
 * Branded 404 for every storefront route. One boundary serves two cases it
 * cannot distinguish (not-found.tsx receives no params): a host/slug that
 * matches no store at all, and a missing product/page on a real store — so
 * the copy stays neutral between them. Status is 404 either way; before this
 * file existed the same cases rendered Next's unbranded default error page.
 */

import { headers } from 'next/headers'
import { showsNiblrBranding } from '@/lib/branding'
import { storeForHost } from '@/store-loader'

export default async function StorefrontNotFound() {
  // Same branding decision as the storefront footer: the store loader decides
  // (hosted: billing state; single-store build: never). An unresolvable host
  // shows the line, as the footer would.
  let showBranding = true
  try {
    showBranding = showsNiblrBranding(await storeForHost(await headers()))
  } catch {
    // Rendered outside a request scope (static prerender): keep the default.
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">404</p>
      <h1 className="text-2xl font-bold text-gray-900">There&rsquo;s nothing at this address</h1>
      <p className="max-w-sm text-[15px] leading-relaxed text-gray-500">
        The store or page you&rsquo;re looking for doesn&rsquo;t exist — it may have moved, or the
        link may be mistyped. Check the address, or head back to the store&rsquo;s home page.
      </p>
      <a
        href="/"
        className="mt-2 rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:border-gray-400"
      >
        Go to the home page
      </a>
      {showBranding && (
        <a
          href="https://niblr.store"
          className="mt-6 text-xs text-gray-400 transition-colors hover:text-gray-600"
        >
          Powered by Niblr
        </a>
      )}
    </main>
  )
}
