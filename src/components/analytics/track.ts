'use client'
import { sendGAEvent } from '@next/third-parties/google'

/**
 * Fire a GA4 event. Safe no-op when GA isn't loaded on the current surface
 * (e.g. a tenant that hasn't configured a Measurement ID) — @next/third-parties'
 * <GoogleAnalytics> initializes window.dataLayer, so its presence means GA is on.
 */
export function trackEvent(name: string, params: Record<string, unknown>): boolean {
  const g = globalThis as { dataLayer?: unknown[] }
  if (!g.dataLayer) return false
  sendGAEvent('event', name, params)
  return true
}
