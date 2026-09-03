'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button } from '@/components/admin/brand/ui'
import type { SampleCounts } from '@/lib/sample-seed'

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * "10 sample products, 3 categories and 10 images", listing only what is
 * actually there — or null when nothing in the catalogue is.
 *
 * Zeroes are skipped rather than printed because the card no longer appears
 * only for catalogue rows: a merchant who bulk-deletes the seeded products,
 * categories and media still has the sample homepage, and this card is the only
 * thing that resets it. Naively formatted, that merchant would be asked to
 * confirm "Remove 0 products, 0 categories and 0 images?".
 */
function describeCounts(counts: SampleCounts, productNoun: [string, string]): string | null {
  const parts: string[] = []
  if (counts.products > 0) parts.push(plural(counts.products, ...productNoun))
  if (counts.categories > 0) parts.push(plural(counts.categories, 'category', 'categories'))
  if (counts.media > 0) parts.push(plural(counts.media, 'image', 'images'))
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * Shown only while a tenant still has sample content.
 *
 * The confirmation states the real counts and says plainly that edited rows go
 * too — because they do. Removal matches on the flag, not on whether the
 * merchant changed the row. It also names the homepage, which is the one row
 * that is reset rather than deleted, and which the counts above do not mention.
 *
 * TenantDashboard renders this only while at least one of the four counts is
 * non-zero, so the "homepage only" branch below implies `counts.pages > 0`.
 */
export function RemoveSampleContentCard({ counts }: { counts: SampleCounts }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/samples/remove', {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Could not remove the sample products.')
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setPending(false)
      setConfirming(false)
    }
  }

  const summary = describeCounts(counts, ['sample product', 'sample products'])
  const confirmList = describeCounts(counts, ['product', 'products'])
  // The homepage is the only sample row left. Copy written for a catalogue does
  // not survive that case, so this branch gets its own.
  const homepageOnly = summary === null

  return (
    <Card title={homepageOnly ? 'Sample homepage' : 'Sample products'}>
      <p>
        {homepageOnly ? (
          <>
            Your storefront homepage came from a sample pack. Reset it to the standard starter
            layout whenever you like.
          </>
        ) : (
          <>
            Your store has {summary}. Edit them like your own, or remove them all. They count
            towards your plan&rsquo;s product limit.
            {counts.pages > 0 && ' Your homepage came with the pack too.'}
          </>
        )}
      </p>

      {!confirming ? (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          {homepageOnly ? 'Reset sample homepage' : 'Remove sample products'}
        </Button>
      ) : (
        <>
          <p role="alert">
            {!homepageOnly &&
              `Remove ${confirmList}? This includes any you have edited. It cannot be undone.`}
            {counts.pages > 0 &&
              // "including any changes you made to it" read as though those
              // changes were carried across. They are destroyed. This is the
              // confirmation step of an irreversible action; it has to say so.
              (homepageOnly
                ? 'Reset your homepage to the standard starter layout, discarding any changes' +
                  ' you made to it? It cannot be undone.'
                : ' Your homepage goes back to the standard starter layout, discarding any' +
                  ' changes you made to it.')}
          </p>
          <Button variant="primary" size="sm" onClick={remove} disabled={pending}>
            {pending ? 'Removing…' : homepageOnly ? 'Yes, reset it' : 'Yes, remove them'}
          </Button>{' '}
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
        </>
      )}

      {error && <p role="alert">{error}</p>}
    </Card>
  )
}
