'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  reviewGate,
  projectedVariationRequests,
  describeDuration,
  type ReviewItem,
} from '@/imports/core/review'
import { driveImport, type TickResponse, type ImportProgress } from '@/imports/core/import-driver'
import type { ImportWarning } from '@/imports/core/types'
import { Card, Button, Badge } from '@/components/admin/brand/ui'
import { formatMinorExact, parseMinorExact } from '@/lib/money-exact'
import './import-review.css'

export type ReviewItemVM = ReviewItem & {
  title: string
  thumbnailUrl: string | null
  warnings: ImportWarning[]
  error?: string | null
}

type Props = {
  jobId: number
  sourceUrl: string
  sourceLabel: string
  storeCurrency: string
  initialItems: ReviewItemVM[]
  initialTaxTreatment: 'inclusive' | 'exclusive' | null
  initialOwnershipAttested: boolean
  maxProducts: number
  existingProductCount: number
  initialStatus: 'ready' | 'importing' | 'completed' | 'failed'
  initialImported: number
  initialFailed: number
  selectedCount: number
  jobError: string | null
}

type Phase = 'review' | 'importing' | 'done' | 'failed'

/** What each warning code means, in the merchant's terms. */
const WARNING_LABELS: Record<string, string> = {
  no_price: 'No price',
  no_images: 'No images',
  many_variants: 'Many variants',
  boilerplate_description: 'Generic description',
  variants_unavailable: 'Variants unavailable',
  duplicate_sku: 'Duplicate SKU',
  inventory_unknown: 'Stock not published',
  currency_mismatch: 'Currency mismatch',
}

const PLATFORM_LABELS: Record<string, string> = {
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
}

export function ImportReviewClient(props: Props) {
  const [items, setItems] = useState<ReviewItemVM[]>(() =>
    // An unpriced item starts deselected — it cannot be imported until a price
    // is set, so selecting it by default would only produce a blocker.
    props.initialItems.map((item) =>
      item.status === 'pending'
        ? { ...item, status: item.warnings.includes('no_price') ? 'skipped' : 'selected' }
        : item,
    ),
  )
  const [taxTreatment, setTaxTreatment] = useState(props.initialTaxTreatment)
  const [ownershipAttested, setOwnershipAttested] = useState(props.initialOwnershipAttested)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(props.jobError)

  const [phase, setPhase] = useState<Phase>(() => {
    if (props.initialStatus === 'completed') return 'done'
    if (props.initialStatus === 'failed') return 'failed'
    if (props.initialStatus === 'importing') return 'importing'
    return 'review'
  })
  const [progress, setProgress] = useState<ImportProgress>({
    imported: props.initialImported,
    failed: props.initialFailed,
    remaining: props.selectedCount - props.initialImported - props.initialFailed,
    total: props.selectedCount,
  })

  const platform = PLATFORM_LABELS[props.sourceLabel] ?? props.sourceLabel
  const currency = props.storeCurrency || 'USD'
  const money = (minor: number | null) => (minor === null ? '—' : formatMinorExact(minor, currency))

  // ── The pump ────────────────────────────────────────────────────────────

  const tick = useCallback(async (): Promise<TickResponse> => {
    // A per-request ceiling. One product with images takes ~15s; 90s is generous
    // headroom, and it turns a hung request into a thrown fetch the driver
    // retries rather than an indefinite wait behind a frozen bar.
    const res = await fetch(`/api/imports/${props.jobId}/tick`, {
      method: 'POST',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(90_000),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      return { ok: false, error: (data.error as string) ?? 'The import stopped unexpectedly.' }
    }
    return {
      ok: true,
      imported: Number(data.imported ?? 0),
      failed: Number(data.failed ?? 0),
      remaining: Number(data.remaining ?? 0),
      processed: Number(data.processed ?? 0),
      status: data.status === 'completed' ? 'completed' : 'importing',
    }
  }, [props.jobId])

  const drivingRef = useRef(false)
  const startDriving = useCallback(async () => {
    if (drivingRef.current) return
    drivingRef.current = true
    try {
      const result = await driveImport({
        tick,
        total: progress.total,
        initialImported: progress.imported,
        initialFailed: progress.failed,
        onProgress: setProgress,
      })
      if (result.status === 'completed') {
        // Reload so the summary sees the pruned item list (only failures remain)
        // and the dashboard product count is fresh.
        window.location.reload()
      } else if (result.status === 'failed') {
        setError(result.error)
        setPhase('failed')
      } else if (result.status === 'stalled') {
        setError('The import could not make progress. Reopen this page to resume it.')
        setPhase('failed')
      }
    } catch {
      // The driver already retries dropped connections; reaching here means
      // something unexpected threw. Surface it as a resumable failure rather
      // than leaving the progress bar frozen — the whole point of this screen.
      setError('The import was interrupted. Reopen this page to carry on from where it stopped.')
      setPhase('failed')
    } finally {
      drivingRef.current = false
    }
  }, [tick, progress.total, progress.imported, progress.failed])

  // Resume a running import when the page is reopened mid-flight.
  useEffect(() => {
    if (phase === 'importing') void startDriving()
    // Only re-run on phase change, not on every progress update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Review-phase state ────────────────────────────────────────────────────

  const gate = useMemo(
    () =>
      reviewGate({
        items,
        ownershipAttested,
        taxTreatment,
        maxProducts: props.maxProducts,
        existingProductCount: props.existingProductCount,
      }),
    [items, ownershipAttested, taxTreatment, props.maxProducts, props.existingProductCount],
  )
  const durationNotice = useMemo(() => describeDuration(projectedVariationRequests(items)), [items])
  const selectedCount = items.filter((i) => i.status === 'selected').length

  const setStatus = (id: number, status: ReviewItemVM['status']) =>
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, status } : i)))
  const setAll = (status: ReviewItemVM['status']) =>
    setItems((cur) =>
      cur.map((i) => (status === 'selected' && i.priceMinor === null ? i : { ...i, status })),
    )
  const setTitle = (id: number, title: string) =>
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, title } : i)))
  const setPrice = (id: number, raw: string) =>
    setItems((cur) =>
      cur.map((i) => {
        if (i.id !== id) return i
        if (raw.trim() === '') return { ...i, priceMinor: null }
        try {
          return { ...i, priceMinor: parseMinorExact(raw, currency) }
        } catch {
          return i
        }
      }),
    )

  async function confirmImport() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/imports/${props.jobId}/review`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ownershipAttested,
          priceTaxTreatment: taxTreatment,
          items: items.map((i) => ({
            id: i.id,
            status: i.status,
            priceMinor: i.priceMinor,
            title: i.title,
          })),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        // The route's message is written for the merchant, so show it.
        setError(data.error ?? 'Could not start the import. Please try again.')
        return
      }
      setProgress({ imported: 0, failed: 0, remaining: selectedCount, total: selectedCount })
      setPhase('importing') // the effect starts the pump
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'importing') return <ImportingView progress={progress} platform={platform} />
  if (phase === 'done')
    return (
      <DoneView
        imported={progress.imported}
        failures={items.filter((i) => i.status === 'failed')}
        sourceUrl={props.sourceUrl}
      />
    )
  if (phase === 'failed')
    return (
      <FailedView
        error={error ?? 'The import did not finish.'}
        imported={progress.imported}
        onBack={() => {
          setError(null)
          setPhase('review')
        }}
      />
    )

  return (
    <div className="nb-view nb-stack">
      <div>
        <h1>Import from {platform}</h1>
        <p>
          {items.length} product{items.length === 1 ? '' : 's'} found at{' '}
          <strong>{hostOf(props.sourceUrl)}</strong>. Choose what to bring across — everything
          arrives as a draft, and nothing goes live until you publish it.
        </p>
      </div>

      <Card title="Before you import">
        <div className="nb-stack">
          {props.storeCurrency ? (
            <p>
              Prices import as <Badge tone="brand">{props.storeCurrency}</Badge> with no conversion.
            </p>
          ) : null}

          <label className="nb-attest">
            <input
              type="checkbox"
              checked={ownershipAttested}
              onChange={(e) => setOwnershipAttested(e.target.checked)}
            />
            <span>I own this store, or I&apos;m authorised to import from it.</span>
          </label>

          <fieldset className="nb-fieldset">
            <legend>Do the prices on your existing store include tax?</legend>
            <label className="nb-radio">
              <input
                type="radio"
                name="tax"
                checked={taxTreatment === 'inclusive'}
                onChange={() => setTaxTreatment('inclusive')}
              />
              <span>Yes, prices include tax</span>
            </label>
            <label className="nb-radio">
              <input
                type="radio"
                name="tax"
                checked={taxTreatment === 'exclusive'}
                onChange={() => setTaxTreatment('exclusive')}
              />
              <span>No, tax is added at checkout</span>
            </label>
          </fieldset>

          {durationNotice ? <p className="nb-note">{durationNotice}</p> : null}
        </div>
      </Card>

      <Card
        title={`Products (${selectedCount} of ${items.length} selected)`}
        action={
          <div className="nb-actions">
            <Button variant="ghost" size="sm" onClick={() => setAll('selected')}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAll('skipped')}>
              Clear
            </Button>
          </div>
        }
        flush
      >
        <div className="nb-table-wrap">
          <table className="nb-table nb-import-grid">
            <thead>
              <tr>
                <th aria-label="Import" />
                <th>Product</th>
                <th>Price</th>
                <th>Variants</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} data-selected={item.status === 'selected'}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Import ${item.title}`}
                      checked={item.status === 'selected'}
                      disabled={item.priceMinor === null}
                      onChange={(e) => setStatus(item.id, e.target.checked ? 'selected' : 'skipped')}
                    />
                  </td>
                  <td>
                    <div className="nb-import-product">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" width={40} height={40} loading="lazy" />
                      ) : (
                        <span className="nb-import-thumb--empty" aria-hidden />
                      )}
                      <input
                        aria-label={`Title for ${item.title}`}
                        value={item.title}
                        onChange={(e) => setTitle(item.id, e.target.value)}
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      className="nb-import-price"
                      aria-label={`Price for ${item.title}`}
                      defaultValue={item.priceMinor === null ? '' : money(item.priceMinor)}
                      placeholder="Set a price"
                      onChange={(e) => setPrice(item.id, e.target.value)}
                    />
                  </td>
                  <td>{item.variantCount}</td>
                  <td>
                    <div className="nb-import-warnings">
                      {item.warnings.map((w) => (
                        <Badge key={w} tone={w === 'no_price' ? 'warning' : 'neutral'}>
                          {WARNING_LABELS[w] ?? w}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {gate.blockers.length > 0 ? (
        <div className="nb-callout">
          <strong>Before you can import:</strong>
          <ul>
            {gate.blockers.map((b) => (
              <li key={b.code}>{b.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div className="nb-callout nb-callout--danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="nb-import-footer">
        <Button variant="primary" onClick={confirmImport} disabled={!gate.canImport || busy}>
          {busy ? 'Starting…' : `Import ${selectedCount} product${selectedCount === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  )
}

// ── Phase views ───────────────────────────────────────────────────────────

function ImportingView({ progress, platform }: { progress: ImportProgress; platform: string }) {
  const done = progress.imported + progress.failed
  const pct = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0
  return (
    <div className="nb-view nb-stack">
      <h1>Importing from {platform}</h1>
      <Card>
        <div className="nb-callout nb-callout--live" role="status" aria-live="polite">
          Importing {done} of {progress.total}
          {progress.failed > 0 ? ` — ${progress.failed} couldn't be added` : ''}. This can take a
          few minutes for a large catalog; you can leave this page and come back.
        </div>
        <div
          className="nb-progress"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="nb-progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="nb-note">{pct}% complete</p>
      </Card>
    </div>
  )
}

function DoneView({
  imported,
  failures,
  sourceUrl,
}: {
  imported: number
  failures: ReviewItemVM[]
  sourceUrl: string
}) {
  return (
    <div className="nb-view nb-stack">
      <h1>Import complete</h1>
      <Card>
        <div className="nb-stack">
          <p className="nb-import-headline">
            <Badge tone="positive" dot>
              {imported} product{imported === 1 ? '' : 's'} imported
            </Badge>{' '}
            as drafts from {hostOf(sourceUrl)}.
          </p>
          <p>
            Review and publish them when you&apos;re ready — prices and stock came across as-is, so
            it&apos;s worth a look before they go live.
          </p>
          {failures.length > 0 ? (
            <div className="nb-callout nb-callout--danger">
              <strong>
                {failures.length} product{failures.length === 1 ? '' : 's'} couldn&apos;t be added:
              </strong>
              <ul>
                {failures.map((f) => (
                  <li key={f.id}>
                    {f.title} — {f.error ?? 'unknown error'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="nb-actions">
            <Button href="/admin/collections/products?where[status][equals]=draft" variant="primary">
              Review imported products
            </Button>
            <Button href="/admin" variant="ghost">
              Back to dashboard
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function FailedView({
  error,
  imported,
  onBack,
}: {
  error: string
  imported: number
  onBack: () => void
}) {
  return (
    <div className="nb-view nb-stack">
      <h1>Import stopped</h1>
      <Card>
        <div className="nb-stack">
          <div className="nb-callout nb-callout--danger" role="alert">
            {error}
          </div>
          {imported > 0 ? (
            <p>
              {imported} product{imported === 1 ? '' : 's'} imported before it stopped, and{' '}
              {imported === 1 ? 'it has' : 'they have'} been kept as drafts.
            </p>
          ) : null}
          <div className="nb-actions">
            <Button variant="primary" onClick={onBack}>
              Back to review
            </Button>
            <Button href="/admin" variant="ghost">
              Back to dashboard
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

/** Show the host, not the full URL — friendlier and shorter. */
function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
