'use client'
import * as React from 'react'
import { storeIdOf } from '@/store-scope'

/** The shape this component reads off `/api/media/<id>?depth=0` and `/api/media?...`. */
type MediaDoc = {
  id: string | number
  url?: string | null
  alt?: string | null
  /** `depth=0` returns this as a bare id; a populated response would nest it. */
  tenant?: string | number | { id?: string | number } | null
}

/** One page of `/api/media`. `hasNextPage` is what drives the Load more control. */
type MediaListResponse = { docs?: MediaDoc[]; hasNextPage?: boolean }

const PAGE_SIZE = 24
const SEARCH_DEBOUNCE_MS = 250

/** Relationship values arrive populated (`{ id }`) or bare — never assume which. */
function tenantKey(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'object') {
    const id = (value as { id?: string | number }).id
    return id === undefined || id === null ? undefined : String(id)
  }
  return String(value)
}

/**
 * Brackets are left literal rather than run through `URLSearchParams`, which
 * would percent-encode them. Payload parses the query with `qs`, which decodes
 * before it parses bracket structure, so either form works — literal brackets
 * just keep the URL readable in the network tab and exact-matchable in tests.
 */
function listUrl(page: number, query: string, tenantId: string | number | null | undefined): string {
  const parts = [`limit=${PAGE_SIZE}`, 'depth=0', 'sort=-createdAt', `page=${page}`]
  const tenant = tenantKey(tenantId)
  if (tenant !== undefined) parts.push(`where[tenant][equals]=${encodeURIComponent(tenant)}`)
  const trimmed = query.trim()
  if (trimmed !== '') parts.push(`where[alt][like]=${encodeURIComponent(trimmed)}`)
  return `/api/media?${parts.join('&')}`
}

const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 }
const thumbRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
const thumbStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  objectFit: 'cover',
  borderRadius: 6,
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-elevation-50)',
}
const buttonStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 4,
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-input-bg, transparent)',
  color: 'var(--theme-text)',
  cursor: 'pointer',
  fontSize: 13,
}
const panelStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 6,
  padding: 10,
  marginTop: 4,
}
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
  gap: 8,
  marginTop: 8,
  maxHeight: 260,
  overflowY: 'auto',
}
const noteStyle: React.CSSProperties = { fontSize: 13, color: 'var(--theme-elevation-500)', margin: 0 }
const warnStyle: React.CSSProperties = { fontSize: 13, color: 'var(--theme-error-500)', margin: '6px 0 0' }
const linkStyle: React.CSSProperties = { color: 'var(--theme-text)' }
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-input-bg, transparent)',
  color: 'var(--theme-text)',
}
const tileStyle: React.CSSProperties = {
  padding: 0,
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 6,
  cursor: 'pointer',
  background: 'transparent',
  overflow: 'hidden',
}
const tileImgStyle: React.CSSProperties = { width: '100%', height: 64, objectFit: 'cover', display: 'block' }

function hasId(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

/**
 * The picker for an `input: 'media'` slot (src/lib/recipe-slot-fields.ts). A
 * recipe's `content` lives in a `json` field, not a real relationship, so
 * there is no Payload `upload` field to attach here — this component owns its
 * own fetch-and-pick UI and hands back a **bare Media id**, never a doc
 * object. That scalar is what src/lib/recipe-media.ts (the storefront
 * resolver) and the content cleaner both expect every slot value to be.
 *
 * Uploading a new file is out of scope: merchants upload through the Media
 * collection and pick here, so both empty states below link to it rather
 * than offering an upload control.
 */
export default function RecipeMediaInput({
  value,
  onChange,
  label,
  controlId,
  tenantId,
}: {
  value: string | number | null | undefined
  onChange: (next: string | number | null) => void
  label?: string
  /**
   * The tenant of the document being edited, read out of form state by
   * `RecipeContentField`. Media that is not this tenant's cannot render on this
   * tenant's storefront (`resolveRecipeMediaByKey`, src/lib/recipe-media.ts,
   * constrains its lookup by tenant), so offering it here can only produce a
   * pick that silently disappears once published. `undefined` — single-tenant
   * self-host, or a collection with no tenant field — means "do not constrain",
   * which is the pre-existing behaviour.
   */
  tenantId?: string | number | null
  /**
   * The id a caller's `<label htmlFor={…}>` points at. This component renders
   * no single input of its own, so the id lands on whichever of the two
   * mutually exclusive primary buttons is showing ("Choose image" when nothing
   * is picked, "Change image" once something is) — both are labelable
   * elements, so the label resolves rather than dangling, and only one of them
   * exists at a time so the id stays unique.
   */
  controlId?: string
}) {
  const [current, setCurrent] = React.useState<MediaDoc | null>(null)
  const [currentStatus, setCurrentStatus] = React.useState<'idle' | 'loading' | 'done'>('idle')
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [docs, setDocs] = React.useState<MediaDoc[] | null>(null)
  const [listStatus, setListStatus] = React.useState<'idle' | 'loading' | 'done'>('idle')
  const [hasNextPage, setHasNextPage] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  /**
   * Bumped on every first-page fetch. Responses check it before writing state,
   * so a slow request for "re" cannot land after the faster one for "red" and
   * repopulate the grid with results the merchant has already typed past.
   */
  const generation = React.useRef(0)

  const hasValue = hasId(value)

  // Fetch the current selection's thumbnail + alt. A 404 (deleted doc, bad
  // id) resolves `res.ok` to false rather than throwing — render the "not
  // found" note instead of letting a rejected promise blow past the effect.
  React.useEffect(() => {
    if (!hasValue) {
      setCurrent(null)
      setCurrentStatus('idle')
      return
    }
    let active = true
    setCurrentStatus('loading')
    setCurrent(null)
    void fetch(`/api/media/${value}?depth=0`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: MediaDoc | null) => {
        if (!active) return
        setCurrent(json)
        setCurrentStatus('done')
      })
      .catch(() => {
        if (active) {
          setCurrent(null)
          setCurrentStatus('done')
        }
      })
    return () => {
      active = false
    }
  }, [value, hasValue])

  // Debounce typing into one request per pause rather than one per keystroke.
  React.useEffect(() => {
    if (query === debouncedQuery) return
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, debouncedQuery])

  /**
   * Search runs on the SERVER, over the whole library. It used to be a
   * `.filter()` across a single page of 24 — which meant a merchant with 25+
   * images could not reach the 25th at all, and was told "No images match your
   * search" about an image that plainly existed.
   *
   * The `tenant` constraint is likewise not redundant. `media` is registered in
   * `the tenant plugin` (src/payload.config.ts), whose `withTenantAccess`
   * wrapper adds a tenant `where` — but only for a user WITHOUT all-tenants
   * access. A super-admin or agency operator gets no constraint, and the
   * admin's own "Filter by Tenant" selector does not apply to a raw REST fetch.
   * Unfiltered, this picker offered another store's media, showed its thumbnail
   * happily, saved clean, and then rendered nothing on the storefront, because
   * `resolveRecipeMediaByKey` (src/lib/recipe-media.ts) correctly refuses media
   * outside the tenant. Scoping the query here is what stops that pick from
   * being offered in the first place. For a merchant the constraint is a no-op
   * that ANDs with the server's own; if it ever disagreed, the intersection is
   * empty, which fails closed.
   */
  React.useEffect(() => {
    if (!pickerOpen) return
    const requestId = ++generation.current
    setListStatus('loading')
    setDocs(null)
    setHasNextPage(false)
    setLoadingMore(false)
    setPage(1)
    void fetch(listUrl(1, debouncedQuery, tenantId), { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: MediaListResponse | null) => {
        if (generation.current !== requestId) return
        setDocs(Array.isArray(json?.docs) ? json.docs : [])
        setHasNextPage(json?.hasNextPage === true)
        setListStatus('done')
      })
      .catch(() => {
        if (generation.current !== requestId) return
        setDocs([])
        setHasNextPage(false)
        setListStatus('done')
      })
  }, [pickerOpen, debouncedQuery, tenantId])

  const loadMore = () => {
    if (loadingMore || !hasNextPage) return
    // Capture the generation rather than bumping it: this appends to the
    // current result set, so a query change mid-flight must discard the page,
    // not merge someone else's results into it.
    const requestId = generation.current
    const nextPage = page + 1
    setLoadingMore(true)
    void fetch(listUrl(nextPage, debouncedQuery, tenantId), { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: MediaListResponse | null) => {
        if (generation.current !== requestId) return
        const more = Array.isArray(json?.docs) ? json.docs : []
        setDocs((prev) => [...(prev ?? []), ...more])
        setHasNextPage(json?.hasNextPage === true)
        setPage(nextPage)
        setLoadingMore(false)
      })
      .catch(() => {
        if (generation.current !== requestId) return
        setLoadingMore(false)
      })
  }

  // The list effect owns fetching, so opening is just a state flip. Reopening
  // refetches, which is how a file uploaded in another tab shows up here
  // without a full page reload.
  const openPicker = () => setPickerOpen(true)

  const pick = (doc: MediaDoc) => {
    // The scalar-slot invariant this whole component exists to protect:
    // a bare id, never the doc.
    onChange(doc.id)
    setPickerOpen(false)
    setQuery('')
  }

  const clear = () => onChange(null)

  const results = docs ?? []
  const searching = debouncedQuery.trim() !== ''

  const chooseLabel = label ? `Choose image for ${label}` : 'Choose image'
  const changeLabel = label ? `Change image for ${label}` : 'Change image'
  const removeLabel = label ? `Remove image for ${label}` : 'Remove image'

  const showThumb = hasValue && currentStatus === 'done' && current !== null
  const notFound = hasValue && currentStatus === 'done' && current === null

  /**
   * An id saved before this picker was scoped — or pasted in by an MCP client —
   * can point at another tenant's media. A merchant without all-tenants access
   * cannot read that doc at all, so they land in `notFound` above; a
   * super-admin CAN read it, and would otherwise see a perfectly healthy
   * thumbnail for an image the storefront will drop on sight.
   */
  const crossTenant =
    showThumb &&
    tenantKey(tenantId) !== undefined &&
    tenantKey(storeIdOf(current)) !== undefined &&
    tenantKey(storeIdOf(current)) !== tenantKey(tenantId)

  return (
    <div style={wrapStyle}>
      {showThumb && current ? (
        <div style={thumbRowStyle}>
          <img src={current.url ?? undefined} alt={current.alt ?? ''} style={thumbStyle} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {current.alt && <span style={{ fontSize: 13 }}>{current.alt}</span>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                id={controlId}
                style={buttonStyle}
                onClick={openPicker}
                aria-label={changeLabel}
              >
                Change image
              </button>
              <button type="button" style={buttonStyle} onClick={clear} aria-label={removeLabel}>
                Remove
              </button>
            </div>
            {crossTenant && (
              <p style={warnStyle}>
                This image belongs to a different store, so it will not appear on your storefront. Choose one from
                this store&apos;s Media.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div>
          {notFound ? (
            <p style={noteStyle}>This image could not be found. It may have been removed from Media.</p>
          ) : (
            <p style={noteStyle}>
              No image selected. Upload media from the{' '}
              <a href="/admin/collections/media" style={linkStyle}>
                Media
              </a>{' '}
              collection, then choose it here.
            </p>
          )}
          <button
            type="button"
            id={controlId}
            style={buttonStyle}
            onClick={openPicker}
            aria-label={chooseLabel}
          >
            Choose image
          </button>
        </div>
      )}

      {pickerOpen && (
        <div style={panelStyle}>
          <input
            type="text"
            placeholder="Search by alt text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={inputStyle}
          />
          {listStatus === 'loading' && <p style={noteStyle}>Loading…</p>}
          {listStatus === 'done' && results.length === 0 && (
            <p style={noteStyle}>
              {searching ? (
                'No images match your search.'
              ) : (
                <>
                  No media yet. Upload images from the{' '}
                  <a href="/admin/collections/media" style={linkStyle}>
                    Media
                  </a>{' '}
                  collection, then come back to choose one.
                </>
              )}
            </p>
          )}
          {listStatus === 'done' && results.length > 0 && (
            <div style={gridStyle}>
              {results.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => pick(doc)}
                  style={tileStyle}
                  aria-label={doc.alt || `Media ${doc.id}`}
                >
                  <img src={doc.url ?? undefined} alt={doc.alt ?? ''} style={tileImgStyle} />
                </button>
              ))}
            </div>
          )}
          {listStatus === 'done' && hasNextPage && (
            <button
              type="button"
              style={{ ...buttonStyle, marginTop: 8 }}
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
          <button type="button" style={{ ...buttonStyle, marginTop: 8 }} onClick={() => setPickerOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
