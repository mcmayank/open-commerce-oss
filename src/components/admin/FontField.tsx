'use client'
import * as React from 'react'
import { useField } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import { GOOGLE_FONTS_CSS2_BASE, familyParam } from '@/lib/fonts/url'
import type { PickerFamily } from '@/lib/fonts/types'

/**
 * Searchable Google Fonts picker for StoreSettings.theme.fontFamily and
 * .headingFont.
 *
 * The stored value is the exact family name, which is also what the storefront
 * URL builder emits — so this component must never "helpfully" normalise case
 * or whitespace. Validation lives in the beforeValidate hook on the collection
 * (src/lib/fonts/validate.ts); this is a convenience layer over it, not the
 * control.
 *
 * The catalog this fetches from GET /api/fonts is `PickerFamily[]`, the
 * trimmed shape Task 8 computes server-side — not the raw `CatalogFamily`.
 * In particular `selectable` is derived there from the real `buildFontHref`,
 * so this component treats it as authoritative rather than re-deriving it.
 */

/**
 * Pinned above the search results: the native stack plus the five families
 * that were the entire choice before this picker existed. A merchant opening
 * the field finds their current setup where it has always been, and never has
 * to learn a search box to keep it.
 */
export const QUICK_PICKS = [
  'system',
  'Inter',
  'Poppins',
  'Merriweather',
  'Cormorant Garamond',
  'Jost',
]

/** How many results the list renders at once. The catalog is ~1,800 families. */
const RESULT_CAP = 60

export function filterFamilies(catalog: PickerFamily[], query: string): PickerFamily[] {
  const q = query.trim().toLowerCase()
  const matched = q === '' ? catalog : catalog.filter((f) => f.family.toLowerCase().includes(q))
  return matched.slice(0, RESULT_CAP)
}

function labelText(label: unknown, fallback: string): string {
  if (typeof label === 'string' && label) return label
  return fallback
}

/**
 * Loads a preview stylesheet for the selectable families currently on screen.
 *
 * Scoped to the rendered slice rather than the catalog: previewing all ~1,800
 * families at once would issue ~1,800 stylesheet requests the moment the picker
 * opens. Unselectable rows are skipped — a family with no compatible weight in
 * the storefront's range would only 400 or render nothing, so there is nothing
 * useful to preview. CSP does not apply here: src/proxy.ts's matcher excludes
 * /admin outright, so the storefront policy never reaches this component. (The
 * admin also already loads Google Fonts — see admin-brand.css.)
 */
function useFontPreviews(families: PickerFamily[]): void {
  const previewable = families.filter((f) => f.selectable)
  const key = previewable.map((f) => f.family).join('|')
  React.useEffect(() => {
    if (!key) return
    const href = `${GOOGLE_FONTS_CSS2_BASE}?${key
      .split('|')
      .map((family) => `family=${familyParam(family)}`)
      .join('&')}&display=swap`
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.fontPreview = 'true'
    document.head.appendChild(link)
    return () => {
      link.remove()
    }
    // `key` is the stable identity of this slice; `families` is a fresh array
    // each render and would re-fire the effect on every keystroke — which is why
    // the dep list is `[key]` alone and must stay that way.
  }, [key])
}

const FontField: TextFieldClientComponent = ({ field, path }) => {
  const { value, setValue } = useField<string>({ path })
  const [catalog, setCatalog] = React.useState<PickerFamily[]>([])
  const [query, setQuery] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/fonts')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { families: PickerFamily[] }) => {
        if (!cancelled) setCatalog(body.families ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the font list. Your current font is unchanged.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const results = React.useMemo(() => filterFamilies(catalog, query), [catalog, query])
  useFontPreviews(results)

  const label = labelText(field?.label, field?.name ?? path)
  const desc = typeof field?.admin?.description === 'string' ? field.admin.description : undefined
  const current = value ?? ''

  return (
    <div className="field-type text" style={{ marginBottom: 20 }}>
      <label className="field-label" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
        {label}
      </label>
      {desc && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{desc}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {QUICK_PICKS.map((pick) => (
          <button
            key={pick}
            type="button"
            onClick={() => setValue(pick)}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid var(--theme-elevation-150, #ddd)',
              background: current === pick ? 'var(--theme-elevation-100, #eee)' : 'transparent',
              fontFamily: pick === 'system' ? 'system-ui, sans-serif' : `"${pick}", system-ui`,
              cursor: 'pointer',
            }}
          >
            {pick === 'system' ? 'System' : pick}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setValue('')}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--theme-elevation-150, #ddd)',
            background: current === '' ? 'var(--theme-elevation-100, #eee)' : 'transparent',
            cursor: 'pointer',
          }}
        >
          Template default
        </button>
      </div>

      <input
        type="text"
        value={query}
        placeholder={current ? `Current: ${current} — search to change` : 'Search Google Fonts…'}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', marginBottom: 6 }}
      />

      {error && <div style={{ fontSize: 12, color: 'var(--theme-error-500, #c00)' }}>{error}</div>}

      {query.trim() !== '' && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxHeight: 280,
            overflowY: 'auto',
            border: '1px solid var(--theme-elevation-150, #ddd)',
            borderRadius: 4,
          }}
        >
          {results.map((f) =>
            f.selectable ? (
              <li key={f.family}>
                <button
                  type="button"
                  onClick={() => {
                    setValue(f.family)
                    setQuery('')
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: current === f.family ? 'var(--theme-elevation-100, #eee)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontFamily: `"${f.family}", system-ui`, fontSize: 16 }}>
                    {f.family}
                  </span>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>
                    {f.category}
                    {f.variable ? ' · variable' : ''}
                  </span>
                </button>
              </li>
            ) : (
              // Not a <button>, and not clickable: a static family whose every
              // weight falls outside the storefront's 300–800 range would
              // render no custom font at all if chosen, silently. Shown, not
              // filtered out, so a merchant searching for it by name learns
              // why rather than assuming search is broken.
              <li
                key={f.family}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  width: '100%',
                  padding: '8px 10px',
                  opacity: 0.45,
                  cursor: 'not-allowed',
                }}
              >
                <span style={{ fontSize: 16 }}>{f.family}</span>
                <span style={{ fontSize: 11 }}>Unavailable in this theme&rsquo;s weights</span>
              </li>
            ),
          )}
          {results.length === 0 && (
            <li style={{ padding: '8px 10px', fontSize: 12, opacity: 0.7 }}>No matching font.</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default FontField
