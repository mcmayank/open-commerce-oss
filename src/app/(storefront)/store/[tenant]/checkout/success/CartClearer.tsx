'use client'

import { useEffect } from 'react'
import { clearCart } from './actions'

/**
 * Invisible client component that clears the cart cookie once, on mount.
 * Server Components cannot set cookies — this bridges that gap.
 */
export function CartClearer() {
  useEffect(() => {
    clearCart().catch(() => {
      // Non-critical — if the cookie clear fails the cart will expire naturally
    })
  }, [])

  return null
}
