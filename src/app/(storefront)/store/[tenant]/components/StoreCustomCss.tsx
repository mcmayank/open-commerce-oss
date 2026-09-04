import React from 'react'
import { headers } from 'next/headers'
import { sanitizeCustomCss } from '@/lib/custom-css'
import type { StoreSetting } from '@/payload-types'
import { storeIdOf } from '@/store-scope'

/**
 * Reads the per-request nonce set by src/proxy.ts. Wrapped because headers()
 * throws outside a request scope (e.g. a unit test that calls this component
 * directly, with no request context) — that must yield `undefined` rather
 * than blow up the render, same as a request that genuinely has no `x-nonce`
 * header.
 */
async function readNonce(): Promise<string | undefined> {
  try {
    return (await headers()).get('x-nonce') ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Injects the merchant's custom CSS. Server component — one tenant per response.
 *
 * Deliberately NOT rendered on cart, checkout, checkout/success, account or
 * unsubscribe: a `display: none` on the wrong element there kills orders
 * silently. See docs/superpowers/specs/2026-07-30-custom-css-hook-contract-design.md
 * Decision 3, and the ring-fence test in src/app/(storefront)/ring-fence.test.ts.
 *
 * Sanitized again on the way out rather than trusted from the row. Running the
 * same function at write and at read is what stops the two drifting apart — an
 * earlier design had a separate cheap read-time guard, and it had already
 * diverged from the sanitizer in both directions before it shipped. Store
 * settings are cached by getStoreSettings, so this parse is not per-request.
 */
export default async function StoreCustomCss({ settings }: { settings?: StoreSetting | null }) {
  if (!settings || settings.customCssEnabled === false) return null

  const nonce = await readNonce()

  let css: string
  try {
    css = sanitizeCustomCss(settings.customCss)
  } catch (err) {
    // Malformed or oversized CSS reached the row by a route that bypassed the
    // write hook (a direct SQL write, a seed script, a restored backup).
    // Render nothing rather than injecting it, but leave a trail — otherwise
    // "why did my CSS stop working" is unanswerable without querying the DB.
    // Never log the CSS body itself; it can be up to 32KB.
    const tenantId = storeIdOf(settings)
    console.error(
      `[custom-css] sanitizeCustomCss threw for tenant ${tenantId ?? 'unknown'} (store settings id ${settings.id}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    return null
  }
  if (css === '') return null

  return <style nonce={nonce} data-nb-custom-css="" dangerouslySetInnerHTML={{ __html: css }} />
}
