'use client'

import { useEffect, useState } from 'react'
import type { ThemeTokens } from '@/lib/theme-tokens'

/**
 * The active theme's resolved tokens — what an unset branding field inherits.
 *
 * Shared between every consumer, because the branding form renders four colour
 * fields plus a preview and they must not make five identical requests.
 *
 * The share is time-boxed rather than permanent. The Payload admin is a
 * client-side SPA, so a merchant can switch template (the try-on/commit flow at
 * /api/preview/commit) and stay on the same page load — a cache with no expiry
 * would then keep describing the OLD theme, which is exactly the
 * admin-disagrees-with-storefront failure this work exists to remove. 60s
 * matches the hosted host→store cache's TTL convention (src/hosted/lib/admin-host.ts).
 */
const TTL_MS = 60_000

let cache: ThemeTokens | null = null
let cacheExpires = 0
let inFlight: Promise<ThemeTokens | null> | null = null

/** The cached tokens, or null once they have aged past the TTL. */
function freshCache(): ThemeTokens | null {
  return cache && cacheExpires > Date.now() ? cache : null
}

async function load(): Promise<ThemeTokens | null> {
  const fresh = freshCache()
  if (fresh) return fresh
  if (!inFlight) {
    inFlight = fetch('/api/theme/preset', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { tokens?: ThemeTokens } | null) => {
        cache = body?.tokens ?? null
        cacheExpires = cache ? Date.now() + TTL_MS : 0
        return cache
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

export function useThemePreset(): { tokens: ThemeTokens | null; loading: boolean } {
  // Seed from the cache only while it is still fresh — a stale entry must not
  // paint the old theme's colours before the refetch lands.
  const [tokens, setTokens] = useState<ThemeTokens | null>(freshCache)
  const [loading, setLoading] = useState(() => freshCache() === null)

  useEffect(() => {
    let alive = true
    load().then((t) => {
      if (!alive) return
      setTokens(t)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  return { tokens, loading }
}
