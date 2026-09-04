'use client'
import { useEffect } from 'react'
import { trackEvent } from './track'

/**
 * Invisible client component that fires one GA4 event on mount. Pass `dedupeKey`
 * for events that must fire at most once per session (e.g. purchase, so a page
 * refresh doesn't double-count) — deduped via sessionStorage.
 */
export function TrackOnMount({
  event,
  params,
  dedupeKey,
}: {
  event: string
  params: Record<string, unknown>
  dedupeKey?: string
}) {
  useEffect(() => {
    if (dedupeKey) {
      try {
        const k = `ga:${dedupeKey}`
        if (sessionStorage.getItem(k) !== null) return
        if (trackEvent(event, params)) sessionStorage.setItem(k, '1')
      } catch {
        // sessionStorage unavailable (private mode) — fire once without dedupe
        trackEvent(event, params)
      }
      return
    }
    trackEvent(event, params)
    // fire exactly once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
