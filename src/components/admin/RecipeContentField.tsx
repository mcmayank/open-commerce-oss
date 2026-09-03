'use client'
import * as React from 'react'
import { useField, useFormFields, FieldLabel } from '@payloadcms/ui'
import type { JSONFieldClientComponent } from 'payload'
import { parseRecipe } from '@/blocks/recipe/parse'
import { RECIPE_ICON_OPTIONS } from '@/blocks/recipe/icons'
import { itemCountOf, slotFieldsOf, type SlotField } from '@/lib/recipe-slot-fields'
import { parentPathOf } from './variant-path'
import RecipeMediaInput from './RecipeMediaInput'
import { storeIdOf } from '@/store-scope'

type ContentValue = { header?: Record<string, unknown>; items?: Record<string, unknown>[] }

/** The shape this component reads off `/api/section-definitions/<id>?depth=0`. */
type DefinitionDoc = { recipe?: unknown; _status?: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Same coercion `extractTenantId` (src/access/roles.ts) applies to a relationship
 *  value read out of form state: populated (`{ id }`) or bare (`id`), never assume which. */
function extractId(value: unknown): string | number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'object') return (value as { id?: string | number }).id
  return value as string | number
}

function resolveLabel(label: unknown, fallback: string): string {
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') {
    const record = label as Record<string, string>
    return record.en ?? Object.values(record)[0] ?? fallback
  }
  return fallback
}

const wrapStyle: React.CSSProperties = { marginBottom: 16 }
const noteStyle: React.CSSProperties = { fontSize: 13, color: 'var(--theme-elevation-500)' }
const fieldWrapStyle: React.CSSProperties = { marginBottom: 14 }
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-input-bg, transparent)',
  color: 'var(--theme-text)',
}

/**
 * One input per slot the field's `SlotInput` names, wired to a plain
 * controlled `<input>`/`<textarea>`/`<select>` — the values this writes are
 * always scalars (strings), which is what the recipe's `content` shape
 * requires per slot.
 *
 * `media` delegates to `RecipeMediaInput`, which owns its own fetch-and-pick
 * UI but still only ever hands back a bare id (or `null`) through this same
 * `onChange(next: string)` contract — coerced to a string here so every slot
 * in `content` stays a plain scalar, never an object.
 */
function SlotInput({
  id,
  field,
  value,
  onChange,
  tenantId,
}: {
  id: string
  field: SlotField
  value: unknown
  onChange: (next: string) => void
  /** Passed straight through to the media picker so it can scope its query. */
  tenantId: string | number | undefined
}) {
  const stringValue = typeof value === 'string' ? value : ''

  switch (field.input) {
    case 'textarea':
      return (
        <textarea
          id={id}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
        />
      )
    case 'icon':
      return (
        <select id={id} value={stringValue} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          <option value="">Choose an icon…</option>
          {RECIPE_ICON_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    case 'url':
      return (
        <input
          id={id}
          type="url"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )
    case 'media': {
      // An empty string is how a cleared slot is stored (see stringValue
      // above) — it must read back as "nothing picked", not as a literal id.
      const mediaValue: string | number | null =
        typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? value : null
      return (
        <RecipeMediaInput
          // The sibling <label htmlFor={id}> must point at something. Every
          // other branch here puts `id` on its own control; the media branch
          // has no single input of its own, so the id goes on the picker's
          // primary button — a `<button>` is a labelable element, so the label
          // is attached rather than orphaned, and clicking it opens the picker.
          controlId={id}
          value={mediaValue}
          onChange={(next) => onChange(next === null ? '' : String(next))}
          label={field.label}
          tenantId={tenantId}
        />
      )
    }
    case 'text':
    default:
      return (
        <input id={id} type="text" value={stringValue} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      )
  }
}

/**
 * The generated content form for a placed `customSection` block (Plan: recipe
 * authoring, Task 7). Payload builds field schemas at boot and cannot know a
 * merchant's section shape ahead of time, so this single JSON field walks
 * whichever recipe the sibling `definition` relationship names, via the pure
 * `slotFieldsOf` (src/lib/recipe-slot-fields.ts), and renders one input per
 * declared slot.
 *
 * Generated from the definition's PUBLISHED version, never its draft: the
 * storefront (src/blocks/CustomSection/Component.tsx) only ever renders a
 * published definition, so a form built off a draft would offer fields for a
 * design the live page does not show — filling them in would be a trap.
 */
const RecipeContentField: JSONFieldClientComponent = ({ path, field }) => {
  const { value, setValue } = useField<ContentValue>({ path })

  const parent = parentPathOf(path)
  const definitionId = useFormFields(([fields]) => extractId(fields[`${parent}.definition`]?.value))
  // The tenant of the document being edited, not of the block: `tenant` is the
  // top-level field the multi-tenant plugin adds to every registered
  // collection, so it lives at the document root regardless of how deeply
  // nested this block is. A media pick has to belong to the same tenant as the
  // page that will render it — see `RecipeMediaInput`'s `tenantId` prop for why
  // relying on access control alone is not enough. `undefined` in single-tenant
  // self-host, where there is no such field.
  const tenantId = useFormFields(([fields]) => storeIdOf({ tenant: fields.tenant?.value }))

  const [doc, setDoc] = React.useState<DefinitionDoc | null>(null)
  // `fetchFailed` is distinct from "doc exists but is a draft": it means the
  // request itself didn't come back with a usable document at all — a 404
  // (the definition was deleted), a 403 (no access), or a network error. Left
  // folded into "not published", a merchant whose section was deleted would
  // be told to publish something that no longer exists.
  const [fetchFailed, setFetchFailed] = React.useState(false)
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'done'>('idle')

  React.useEffect(() => {
    if (definitionId === undefined) {
      setDoc(null)
      setFetchFailed(false)
      setStatus('idle')
      return
    }
    let active = true
    setStatus('loading')
    setDoc(null)
    setFetchFailed(false)
    void fetch(`/api/section-definitions/${definitionId}?depth=0`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return { ok: false as const }
        return { ok: true as const, json: (await res.json()) as DefinitionDoc }
      })
      .then((result) => {
        if (!active) return
        if (result.ok) {
          setDoc(result.json)
          setFetchFailed(false)
        } else {
          setDoc(null)
          setFetchFailed(true)
        }
        setStatus('done')
      })
      .catch(() => {
        if (active) {
          setDoc(null)
          setFetchFailed(true)
          setStatus('done')
        }
      })
    return () => {
      active = false
    }
  }, [definitionId])

  const label = resolveLabel(field?.label, 'Content')

  if (definitionId === undefined) {
    return (
      <div className="field-type" style={wrapStyle}>
        <FieldLabel label={label} path={path} />
        <p style={noteStyle}>Choose a section above to fill it in.</p>
      </div>
    )
  }

  if (status !== 'done') {
    return (
      <div className="field-type" style={wrapStyle}>
        <FieldLabel label={label} path={path} />
        <p style={noteStyle}>Loading…</p>
      </div>
    )
  }

  if (fetchFailed || !doc) {
    return (
      <div className="field-type" style={wrapStyle}>
        <FieldLabel label={label} path={path} />
        <p style={noteStyle}>
          This section could not be loaded. It may have been deleted, or you may not have access to it.
        </p>
      </div>
    )
  }

  if (doc._status !== 'published') {
    return (
      <div className="field-type" style={wrapStyle}>
        <FieldLabel label={label} path={path} />
        <p style={noteStyle}>Publish this section before filling it in.</p>
      </div>
    )
  }

  // The collection's own `validate` hook already rejects an unparseable
  // recipe at write time (src/collections/SectionDefinitions.ts) — but that
  // is convenience, not the security boundary, and this row is not trusted
  // just because it round-tripped through Payload once. A direct SQL write
  // bypassing that hook, or a row from an older schema, is a documented
  // reality this codebase already defends against on the read path
  // (src/blocks/CustomSection/Component.tsx re-parses for the same reason).
  // `slotFieldsOf` itself has no defence against a malformed `template`
  // (a `null` entry, or a `template` that isn't an array at all) — it would
  // throw mid-render with no error boundary above it, blanking the merchant's
  // whole edit view. Re-parsing here is what stands between untrusted stored
  // JSON and that crash.
  let recipe: ReturnType<typeof parseRecipe>
  try {
    recipe = parseRecipe(doc.recipe)
  } catch {
    return (
      <div className="field-type" style={wrapStyle}>
        <FieldLabel label={label} path={path} />
        <p style={noteStyle}>This section&apos;s layout is not valid. Pick a starting layout again.</p>
      </div>
    )
  }

  const fields = slotFieldsOf(recipe)
  const headerFields = fields.filter((f) => f.scope === 'header')
  const itemFields = fields.filter((f) => f.scope === 'item')
  const itemCount = itemCountOf(recipe)

  const header = isRecord(value?.header) ? value!.header! : {}
  const items = Array.isArray(value?.items) ? value!.items! : []
  const itemAt = (index: number): Record<string, unknown> => (isRecord(items[index]) ? items[index]! : {})
  // A previously-published recipe could have declared more items than this
  // one does (republished with a smaller `count`) — those extra rows are
  // still sitting in stored `content` even though the form below only shows
  // `itemCount` of them.
  const hiddenCount = Math.max(0, items.length - itemCount)

  const writeHeader = (name: string, next: string) => {
    setValue({ header: { ...header, [name]: next }, items })
  }

  const writeItem = (index: number, name: string, next: string) => {
    // Never shrink the stored array to `itemCount` on write: a merchant who
    // filled in 5 items against an older, wider recipe still has those 5
    // saved, even though this recipe's `count` has since dropped to 3 and the
    // form below shows only 3 fieldsets. Padding to `max(itemCount,
    // items.length)` — not `itemCount` — is what keeps typing into item 0
    // from silently discarding items 3 and 4 on the very next keystroke.
    const targetLength = Math.max(itemCount, items.length)
    const nextItems = Array.from({ length: targetLength }, (_, i) => ({ ...itemAt(i) }))
    nextItems[index] = { ...nextItems[index], [name]: next }
    setValue({ header, items: nextItems })
  }

  return (
    <div className="field-type" style={wrapStyle}>
      <FieldLabel label={label} path={path} />
      {hiddenCount > 0 && (
        <p style={noteStyle}>
          This section now shows {itemCount} item{itemCount === 1 ? '' : 's'}. {hiddenCount} additional
          item{hiddenCount === 1 ? '' : 's'} you filled in earlier {hiddenCount === 1 ? 'is' : 'are'} kept but hidden
          until the layout allows more.
        </p>
      )}
      {headerFields.map((f) => (
        <div key={f.name} style={fieldWrapStyle}>
          <label style={labelStyle} htmlFor={`${path}-header-${f.name}`}>
            {f.label}
          </label>
          <SlotInput
            id={`${path}-header-${f.name}`}
            field={f}
            value={header[f.name]}
            onChange={(next) => writeHeader(f.name, next)}
            tenantId={tenantId}
          />
        </div>
      ))}
      {itemFields.length > 0 &&
        Array.from({ length: itemCount }, (_, index) => (
          <fieldset
            key={index}
            style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 12, marginBottom: 14 }}
          >
            <legend style={{ fontWeight: 600, fontSize: 13, padding: '0 4px' }}>Item {index + 1}</legend>
            {itemFields.map((f) => (
              <div key={f.name} style={fieldWrapStyle}>
                <label style={labelStyle} htmlFor={`${path}-item-${index}-${f.name}`}>
                  {f.label}
                </label>
                <SlotInput
                  id={`${path}-item-${index}-${f.name}`}
                  field={f}
                  value={itemAt(index)[f.name]}
                  onChange={(next) => writeItem(index, f.name, next)}
                  tenantId={tenantId}
                />
              </div>
            ))}
          </fieldset>
        ))}
    </div>
  )
}

export default RecipeContentField
