'use client'
import * as React from 'react'
import { useField, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import type { BlockStyle } from '@/lib/block-style/vocabulary'
import { setControlValue, asBlockStyleMap, setBlockStyleInMap, styleGroupsFor } from '@/lib/block-style/panel'
import { parentPathOf } from './variant-path'
import { AllStyleGroups } from './StyleControlGroups'

/**
 * Per-instance "Style" panel — Task 6. A `type: 'ui'` field (no DB column) added
 * once per block config (see `src/blocks/Hero/config.ts`); renders §3 vocabulary
 * controls and persists the chosen values into the PAGE-level `pages.blockStyles`
 * jsonb, keyed by this block's own `id`, not into any field on the block itself.
 *
 * SPIKE OUTCOME (see task-6-report.md for the full writeup): a block-scoped UI
 * field CAN read/write a sibling top-level field. The mechanism is two calls to
 * Payload's admin form hooks:
 *
 *  1. This field's own `path` prop is `layout.<i>.<uiFieldName>` — its block's
 *     row is the parent path (`parentPathOf`), and every block row carries an
 *     auto-generated `id` field (Payload always adds one, rendered as a
 *     `HiddenField`; see `@payloadcms/ui/dist/fields/Hidden/index.js`, whose own
 *     doc comment says "this sets the `id` property of a block in the Blocks
 *     field"). Reading `fields['layout.<i>.id'].value` via
 *     `useFormFields(([fields]) => ...)` gives this block's id — the same
 *     `useFormFields` selector `VariantPickerField` already uses to read the
 *     sibling `blockType`.
 *  2. `useField` accepts an explicit `path` option that does NOT have to match
 *     this component's own field-context path — `useFieldInForm` resolves
 *     `path = pathFromOptions || pathFromContext`, so `useField({ path:
 *     'blockStyles' })` binds directly to the page's top-level `blockStyles`
 *     field's value/setValue, from inside a component nested at
 *     `layout.<i>.<uiFieldName>`. `blockStyles` is `admin.hidden: true`, which
 *     Payload renders as a `HiddenField` (not "not rendered") — it still
 *     participates in client form state, so `setValue` here dispatches the same
 *     `{ type: 'UPDATE', path: 'blockStyles', value }` action a visible field
 *     would, and it saves with the rest of the page form.
 *
 * No fallback was needed — the block config does not need its own `blockStyle`
 * json field.
 *
 * The control rendering itself (`AllStyleGroups` → `TypographyGroup` /
 * `ControlGroupPanel`) lives in `./StyleControlGroups`, shared with Task 7's
 * `BlockStyleDefaultsField` (store-wide defaults, keyed by blockType instead
 * of block id) — same vocabulary, same widgets, only the storage key differs.
 */
const BlockStyleField: UIFieldClientComponent = ({ path }) => {
  const parentPath = parentPathOf(path)
  const blockId = useFormFields(([fields]) => {
    const idField = fields[`${parentPath}.id`]
    return typeof idField?.value === 'string' ? idField.value : undefined
  })
  // Sibling `blockType` field, same array index — same selector VariantPickerField
  // uses. Needed so this panel only offers the groups this block's markup reads
  // (`styleGroupsFor`) instead of all six for every block.
  const blockType = useFormFields(([fields]) => {
    const f = fields[`${parentPath}.blockType`]
    return typeof f?.value === 'string' ? f.value : undefined
  })

  const { value: blockStylesValue, setValue: setBlockStyles } = useField<Record<string, BlockStyle>>({
    path: 'blockStyles',
  })

  const styleMap = React.useMemo(() => asBlockStyleMap(blockStylesValue), [blockStylesValue])
  // Memoized so the `|| {}` fallback does not allocate a fresh object every
  // render and defeat handleChange's useCallback. Matches BlockInspector, which
  // memoizes the identical expression.
  const thisStyle: BlockStyle = React.useMemo(
    () => (blockId && styleMap[blockId]) || {},
    [blockId, styleMap],
  )

  const handleChange = React.useCallback(
    (group: keyof BlockStyle, control: string, value: string | undefined) => {
      if (!blockId) return
      const nextStyle = setControlValue(thisStyle, group, control, value)
      const nextMap = setBlockStyleInMap(styleMap, blockId, nextStyle)
      setBlockStyles(nextMap)
    },
    [blockId, thisStyle, styleMap, setBlockStyles],
  )

  return (
    <div className="field-type" style={{ marginBottom: 16 }}>
      <details style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: '0 12px' }}>
        <summary
          style={{
            padding: '10px 0',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--theme-text)',
          }}
        >
          Style
        </summary>
        {!blockId ? (
          <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)', paddingBottom: 12 }}>
            Save this page once to enable per-block style overrides.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 14 }}>
            <AllStyleGroups
              style={thisStyle}
              groups={styleGroupsFor(blockType)}
              scope="instance"
              onChange={handleChange}
            />
          </div>
        )}
      </details>
    </div>
  )
}

export default BlockStyleField
