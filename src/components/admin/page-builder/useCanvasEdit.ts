'use client'

import * as React from 'react'
import type { EditTargetMessage } from '@/lib/preview-bridge/protocol'
import { PART_FIELD_CANDIDATES, fieldPath, resolveEditField } from '@/lib/page-builder/edit-target'

/** What `CanvasStage` needs to draw an in-place editor: where to put it, what
 *  to seed it with, and — the load-bearing part — which form-state entry to
 *  bind.
 *
 *  Both `path` and `rect` are FROZEN at the moment the editor opens. `path`
 *  embeds the row INDEX, so reordering the layout while an editor is open would
 *  leave it bound to whichever block now sits at that index; `rect` is the
 *  frame's visible-corner geometry, so scrolling the iframe would leave the
 *  editor floating away from its text. Neither is reachable today: every
 *  affordance that could reorder or scroll takes focus first, and blur commits
 *  and closes the editor before the change lands. Recorded so a future
 *  affordance that does NOT blur (a keyboard shortcut, a bridge-driven scroll)
 *  is recognised as breaking this assumption rather than as a mystery. */
export type CanvasEdit = {
  path: string
  initialValue: string
  rect: EditTargetMessage['rect']
}

/**
 * Turns an `edit-target` message from the preview frame into an open editor,
 * or into nothing at all.
 *
 * WHY A HOOK, not inline in `PageBuilderView`: that file cannot be imported by
 * a unit test — the `@payloadcms/ui` barrel pulls a `.css` file Node's ESM
 * loader rejects — so anything with a decision in it lives out here where it
 * can be driven directly. This hook touches nothing but React state and the
 * pure `edit-target` module.
 *
 * RESOLUTION HAPPENS HERE, in the builder, and not in the preview frame: the
 * frame renders published markup and has no idea what the block's field values
 * currently are. Only the builder holds form state, and the text-equality check
 * inside `resolveEditField` — comparing what the merchant double-clicked
 * against the candidate fields' CURRENT values — is exactly what makes reusing
 * the `nb-hooks` styling parts for authoring safe.
 *
 * A `null` resolution is a deliberate no-op. The merchant double-clicked
 * something that cannot be mapped to exactly one field (an unmapped part, a
 * variant branch whose text is not the field value, two CTA labels reading the
 * same). Opening an editor anyway would mean guessing, and a wrong guess writes
 * to a field they were not pointing at. Opening nothing is recoverable; the
 * inspector is right there.
 *
 * `rows` and `fields` are passed in rather than read here, because the caller
 * already reads both from `useFormFields` for the layers rail and the selection
 * actions — a second subscription would be a second source of truth for the
 * same store.
 */
export function useCanvasEdit({
  rows,
  fields,
}: {
  rows: readonly { id?: string }[]
  fields: Record<string, unknown>
}): {
  edit: CanvasEdit | null
  onEditTarget: (target: EditTargetMessage) => void
  closeEdit: () => void
} {
  const [edit, setEdit] = React.useState<CanvasEdit | null>(null)

  const onEditTarget = React.useCallback(
    (target: EditTargetMessage) => {
      // The frame renders the SAVED draft, so it can name a row that form
      // state no longer contains (deleted, or reordered mid-edit).
      const idx = rows.findIndex((row) => row.id === target.blockId)
      if (idx < 0) return

      const candidates = PART_FIELD_CANDIDATES[target.part] ?? []
      const values = Object.fromEntries(
        candidates.map((field) => [field, formValueAt(fields, fieldPath(idx, field))]),
      )

      const field = resolveEditField(target.part, target.text, values)
      // A null result is a DELIBERATE SILENT NO-OP, not a missing branch and not
      // a bug to fix by loosening the resolver. Nothing opens, nothing is
      // written, and the merchant gets no feedback.
      //
      // It is reached most often by parts that are legitimately out of Round 2's
      // scope while still being marked up: `data-nb-part="body"` covers a Hero
      // subheading and a PromoSection body (editable) but ALSO a Contact address
      // and a VideoEmbed caption (not — `PART_FIELD_CANDIDATES.body` lists
      // `subheading` and `body` only), and every `item-*` part addresses an
      // array row, which the spec excludes.
      // It is also reached when the visible text is not the candidate's current
      // value, which means we are on the wrong node — a variant branch, a
      // truncation, an icon label.
      //
      // Silence is the correct behaviour here because the alternative is
      // guessing, and a wrong guess writes the merchant's typing into a field
      // they were not pointing at. Opening nothing is recoverable; the inspector
      // is right there with every field on it. What is genuinely missing is an
      // AFFORDANCE telling merchants which text is editable before they
      // double-click — a UI question for a later round, not a reason to relax
      // the refusal.
      if (!field) return

      // `resolveEditField` only ever returns a field whose value is a string
      // equal to the clicked text, so this cannot widen a non-string value.
      const current = String(values[field] ?? '')

      // Second refusal, same ethos as the one above: several candidate fields
      // are Payload `textarea`s (`subheading` on Hero/MediaHero/SplitHero,
      // `body` on CTABanner/PromoSection/StoryStats), and a multi-line value
      // still RESOLVES — both sides of the equality check are trimmed and the
      // newlines are internal. The editor is a single-line `<input>`, whose
      // value sanitisation strips CR/LF, so committing an edit would silently
      // flatten the merchant's line breaks with no warning. Declining to open
      // is the only honest thing a single-line input can do here. A multi-line
      // canvas editor is a fine later addition; it is not this one.
      if (/[\r\n]/.test(current)) return

      setEdit({
        path: fieldPath(idx, field),
        initialValue: current,
        rect: target.rect,
      })
    },
    [rows, fields],
  )

  const closeEdit = React.useCallback(() => setEdit(null), [])

  return { edit, onEditTarget, closeEdit }
}

/**
 * The current value of one form-state entry. Payload's field bag maps a path to
 * a `{ value, ... }` record; anything else is treated as absent rather than
 * coerced, so a malformed entry declines the edit instead of seeding the editor
 * with a stringified object.
 */
function formValueAt(fields: Record<string, unknown>, path: string): unknown {
  const entry = fields[path]
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return undefined
  return (entry as { value?: unknown }).value
}
