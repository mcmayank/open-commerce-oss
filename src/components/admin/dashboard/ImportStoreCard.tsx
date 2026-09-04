'use client'

import { useState } from 'react'
import { Card, Button } from '@/components/admin/brand/ui'

/**
 * Bring an existing Shopify or WooCommerce catalog into this store.
 *
 * The sibling of `ExportDataCard`: export is the exit from "leave whenever you
 * want", this is the entrance. Same shape, same plan treatment — no gate.
 *
 * Deliberately ONE field. The merchant is not asked which platform they are on:
 * detection walks the source registry server-side, and asking would add a step
 * plus a way to be wrong, since plenty of people describe a WooCommerce store
 * as "my WordPress site".
 *
 * `platforms` is passed in from the registry rather than hardcoded here, so this
 * copy cannot go stale the next time an adapter ships.
 */
export function ImportStoreCard({ platforms }: { platforms: string[] }) {
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supported =
    platforms.length <= 1
      ? platforms[0]
      : `${platforms.slice(0, -1).join(', ')} and ${platforms[platforms.length - 1]}`

  async function start(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/imports', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceUrl: url }),
      })
      const data = (await res.json().catch(() => ({}))) as { jobId?: number; error?: string }

      if (!res.ok) {
        // Discovery's failures are written for the merchant — an unsupported
        // platform, a switched-off feed, a currency mismatch — so they are
        // shown rather than replaced with something generic.
        setError(data.error ?? 'Could not read that store. Please check the address.')
        return
      }

      window.location.href = `/admin/imports/${data.jobId}`
    } catch {
      setError('Could not reach that store. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card title="Already selling somewhere else?">
      <p>
        Paste your store address and we&apos;ll bring your products across as drafts, with their
        images. Nothing goes live until you publish it, and you choose which products to keep
        before anything is added.
      </p>
      <form onSubmit={start}>
        <label htmlFor="import-source-url">Your existing store address</label>
        <input
          id="import-source-url"
          name="sourceUrl"
          type="text"
          inputMode="url"
          placeholder="mystore.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={pending}
          required
        />
        <Button type="submit" variant="primary" disabled={pending || url.trim() === ''}>
          {pending ? 'Reading your store…' : 'Find my products'}
        </Button>
      </form>
      <p>
        <small>
          Works with {supported}. Orders and customers aren&apos;t brought over — only your
          products.
        </small>
      </p>
      {error ? <p role="alert">{error}</p> : null}
    </Card>
  )
}
