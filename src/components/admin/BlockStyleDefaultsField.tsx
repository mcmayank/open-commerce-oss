'use client'
import * as React from 'react'
import { useField } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import type { BlockStyle } from '@/lib/block-style/vocabulary'
import { setControlValue, asBlockStyleMap, setBlockStyleInMap, STYLABLE_BLOCK_TYPES, styleGroupsFor } from '@/lib/block-style/panel'
import { AllStyleGroups } from './StyleControlGroups'

/**
 * Store Settings → "Block style defaults" — Task 7. A `type: 'ui'` field (no
 * DB column of its own) that renders the same §3 vocabulary controls as
 * Task 6's per-instance `BlockStyleField`, one panel per block type, writing
 * into the hidden `blockStyleDefaults` json field keyed by **blockType**
 * rather than by block id — the store-wide layer of `resolveBlockStyle`'s
 * three-layer merge (theme default → this → per-instance `pages.blockStyles`).
 *
 * Reuses Task 6's proven mechanism directly: this field's own path doesn't
 * matter, `useField` takes an explicit `path` that binds to the sibling
 * top-level `blockStyleDefaults` field regardless of where this component is
 * mounted (see BlockStyleField's doc comment for why that works — same
 * `useFieldInForm` behavior, no block-id lookup needed since the key here is
 * a static blockType, not a per-row generated id). The map read/write helpers
 * (`asBlockStyleMap`, `setBlockStyleInMap`) are generic over the key type, so
 * they need no change to serve blockType instead of block id.
 *
 * Offers only `STYLABLE_BLOCK_TYPES` — block types that actually consume the
 * vocabulary (`hero`, currently the only one) — not every block in the
 * registry, so this never renders a control for a block that would silently
 * ignore it.
 */
const BlockStyleDefaultsField: UIFieldClientComponent = () => {
  const { value, setValue } = useField<Record<string, BlockStyle>>({ path: 'blockStyleDefaults' })
  const styleMap = React.useMemo(() => asBlockStyleMap(value), [value])

  // Which panels have been opened. `<details>` hides its children with CSS but
  // still MOUNTS them, so rendering every panel's controls up front put 560
  // <select>s and ~2,500 <option>s — around 4,000 DOM nodes — into the tab
  // before the merchant touched anything. Inside Payload's form context, which
  // re-renders on form-state changes, that made the whole tab sluggish and a
  // summary click look like it did nothing. Contents now mount on first open.
  //
  // `open` is NOT passed back to <details>: the element keeps its own native
  // toggling, and this state only gates the children. Once opened a panel stays
  // mounted, so collapsing and re-expanding does not discard in-progress edits.
  const [opened, setOpened] = React.useState<Record<string, boolean>>({})
  const markOpened = React.useCallback((blockType: string) => {
    setOpened((prev) => (prev[blockType] ? prev : { ...prev, [blockType]: true }))
  }, [])

  const handleChange = React.useCallback(
    (blockType: string) => (group: keyof BlockStyle, control: string, controlValue: string | undefined) => {
      const thisStyle = styleMap[blockType] || {}
      const nextStyle = setControlValue(thisStyle, group, control, controlValue)
      setValue(setBlockStyleInMap(styleMap, blockType, nextStyle))
    },
    [styleMap, setValue],
  )

  return (
    <div className="field-type" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--theme-elevation-500)', marginBottom: 12 }}>
        Store-wide defaults for each block type. Any block of this type uses these unless it has its own Style
        override.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STYLABLE_BLOCK_TYPES.map(({ value: blockType, label }) => (
          <details
            key={blockType}
            onToggle={(event) => {
              if (event.currentTarget.open) markOpened(blockType)
            }}
            style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: '0 12px' }}
          >
            <summary
              style={{
                padding: '10px 0',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--theme-text)',
              }}
            >
              {label}
            </summary>
            {opened[blockType] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 14 }}>
                <AllStyleGroups
                  style={styleMap[blockType] || {}}
                  groups={styleGroupsFor(blockType)}
                  scope="store"
                  onChange={handleChange(blockType)}
                />
              </div>
            )}
          </details>
        ))}
      </div>
    </div>
  )
}

export default BlockStyleDefaultsField
