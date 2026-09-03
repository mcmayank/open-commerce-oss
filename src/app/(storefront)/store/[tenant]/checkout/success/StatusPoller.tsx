'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Polls the store-scoped order-status endpoint until the webhook marks the order
 * paid. Reaching this page is NOT proof of payment — provider query params are
 * never trusted; only the webhook-driven order status flips this to confirmed.
 *
 * States: confirming · confirmed · processing (taking longer) · failed · offline.
 */
type Phase = 'confirming' | 'confirmed' | 'processing' | 'failed' | 'offline'

interface Props {
  tenantSlug: string
  orderId: number | string
  initialStatus: string
  /** 'offline' methods have no webhook — they stay pending until the merchant confirms. */
  mode: 'online' | 'offline'
}

const POLL_INTERVAL_MS = 2500
const MAX_POLLS = 20 // ~50s

export default function StatusPoller({ tenantSlug, orderId, initialStatus, mode }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>(
    initialStatus !== 'pending' ? 'confirmed' : mode === 'offline' ? 'offline' : 'confirming',
  )
  const polls = useRef(0)

  useEffect(() => {
    if (mode === 'offline' || initialStatus !== 'pending') return

    let active = true
    let timer: ReturnType<typeof setTimeout>

    const tick = async () => {
      if (!active) return
      polls.current += 1
      try {
        const res = await fetch(`/api/storefront/order-status/${tenantSlug}/${orderId}`, {
          cache: 'no-store',
        })
        if (res.ok) {
          const data = (await res.json()) as { paid?: boolean; status?: string }
          if (data.paid) {
            setPhase('confirmed')
            router.refresh() // re-render the server page with the paid state
            return
          }
          if (data.status === 'cancelled') {
            setPhase('failed')
            return
          }
        }
      } catch {
        // network blip — keep polling
      }
      if (polls.current >= MAX_POLLS) {
        setPhase('processing')
        return
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [tenantSlug, orderId, initialStatus, mode, router])

  if (phase === 'confirmed') {
    return (
      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-sm font-medium text-green-800">Payment confirmed!</p>
      </div>
    )
  }
  if (phase === 'offline') {
    return (
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-800">
          Order received. Payment will be arranged via the store&rsquo;s offline method
          (e.g. cash on delivery or bank transfer).
        </p>
      </div>
    )
  }
  if (phase === 'failed') {
    return (
      <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-800">
          Your payment was not completed. If money was debited it will be refunded — you can
          try again from your cart.
        </p>
      </div>
    )
  }
  if (phase === 'processing') {
    return (
      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-sm text-gray-700">
          Your payment is taking a little longer to confirm. We&rsquo;ll email you as soon as it
          completes — no need to pay again.
        </p>
      </div>
    )
  }
  // confirming
  return (
    <div className="mb-6 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
      <p className="text-sm text-yellow-800">Confirming your payment&hellip;</p>
    </div>
  )
}
