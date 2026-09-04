'use server'

import { cookies } from 'next/headers'

/**
 * Clear the cart cookie after a successful purchase.
 * Called client-side from the success page so the cart empties post-checkout.
 */
export async function clearCart(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('cart', '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  })
}
