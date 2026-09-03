'use client'

import { useState } from 'react'
import { Card, Button } from '@/components/admin/brand/ui'

/**
 * Download this store's catalog, orders and customers as a zip of CSVs.
 *
 * Shown on every plan including Free — deliberately no plan check here, matching
 * the route it calls (`/api/export`). Gating a merchant's own data behind a
 * subscription is the hostage lock-in the brand principles rule out.
 *
 * Images are not bundled — the CSVs carry them as links, not files — so the
 * copy below promises exactly that and nothing more.
 */
export function ExportDataCard() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/export', { method: 'POST', credentials: 'same-origin' })
      if (!res.ok) {
        // The route's JSON `error` (e.g. "Not authorised.") is for logs, not this
        // banner: whatever the reason, the merchant's next move is the same —
        // try again or contact support — so one generic message covers every
        // failure without leaking access-control detail into the dashboard.
        setError('Could not build your export. Please try again.')
        return
      }
      // Read the whole body before creating the link: a partial blob would
      // save a truncated archive that still opens.
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = /filename="([^"]+)"/.exec(disposition)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      try {
        anchor.href = url
        anchor.download = match ? match[1] : 'niblr-export.zip'
        document.body.appendChild(anchor)
        anchor.click()
      } finally {
        // `remove()` and the revoke both run even if `click()` throws, so the
        // anchor never lingers in the DOM and the blob URL is never leaked.
        // The revoke is deferred a tick rather than synchronous: Chrome and
        // Firefox start the download before the next tick, but Safari/WebKit
        // — including iOS Safari, which matters in this product's UAE and
        // India markets — has historically cancelled a download whose blob
        // URL is revoked in the same tick as the click.
        anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 0)
      }
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card title="Export your data">
      <p>
        Download your catalog, orders and customers as CSVs, zipped. Yours on every plan,
        including Free — images come along as links, not files.
      </p>
      <Button variant="ghost" size="sm" onClick={download} disabled={pending}>
        {pending ? 'Preparing your export…' : 'Export my data'}
      </Button>
      {error && <p role="alert">{error}</p>}
    </Card>
  )
}
