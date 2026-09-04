'use client'

import React from 'react'
import type { FormState } from 'payload'
import {
  useDocumentInfo,
  useLivePreviewContext,
  useServerFunctions,
  usePreferences,
  useForm,
  useFormFields,
  useField,
  Form,
  OperationProvider,
} from '@payloadcms/ui'
import type { BlockStyle } from '@/lib/block-style/vocabulary'
import { asBlockStyleMap } from '@/lib/block-style/panel'
import { fitCanvas, type DeviceKey } from '@/lib/page-builder/canvas-fit'
import {
  clampRailWidth,
  canvasSlotWidth,
  CANVAS_MIN_WIDTH,
  RAIL_DEFAULT,
  RAIL_MIN,
  RAIL_COLLAPSED_WIDTH,
} from '@/lib/page-builder/rail-geometry'
import { SelectionProvider, useSelection } from './selection'
import { useBuilderFormState } from './useBuilderFormState'
import { useCanvasEdit } from './useCanvasEdit'
import { usePreviewBridge } from './usePreviewBridge'
import { useRailGrip } from './useRailGrip'
import { useSelectionActions } from './useSelectionActions'
import { LayersRail } from './LayersRail'
import { BlockInspector } from './BlockInspector'
import { PageSettings } from './PageSettings'
import { BuilderTopBar } from './BuilderTopBar'
import { BackToPagesLink } from './BackToPagesLink'
import { CanvasStage } from './CanvasStage'
import { labelForBlockType } from './BlockLibrary'

import './page-builder.css'

/**
 * The Pages page builder — the Phase 3b builder shell.
 *
 * MOUNT POINT: this is no longer `Pages.admin.components.views.edit.default`.
 * It renders inside `PageBuilderRoute`, a full-bleed *root* admin view at
 * `/admin/pages/:id/builder`, which hand-assembles the `DocumentInfoProvider`
 * and `LivePreviewProvider` the Payload Document view used to supply. The one
 * thing that route cannot supply from the server is the initial form state —
 * `buildFormState` is not on `@payloadcms/ui/rsc`'s export surface — so this
 * view hydrates it once on mount (see FORM HYDRATION below).
 *
 * Task 4 scope: a 3-pane layout, a live storefront preview in the center
 * iframe wired to the `usePreviewBridge` postMessage bridge, and Payload's
 * own Save draft/Publish actions. The left pane's block outline shipped in
 * Task 5 and was replaced in Task 8 by `LayersRail`, a content-first rail
 * (see that file's docblock); the right pane's style inspector shipped in
 * Task 6 (`BlockInspector`), which also retired the temporary "Nudge
 * selected" button that had proved the builder → iframe patch round-trip
 * ahead of the real inspector.
 *
 * PREVIEW URL — investigated for this task:
 * Pages.ts defines `admin.preview(doc)`, which builds
 * `/api/preview?secret=<PREVIEW_SECRET>&slug=<slug>`. That function runs
 * SERVER-SIDE only (Payload's `handlePreview` utility, called from
 * `@payloadcms/next`'s Document view), so `PREVIEW_SECRET` never reaches
 * client code. The resolved URL (secret already embedded) is threaded down
 * as the `previewURL` prop of `LivePreviewProvider`, which `PageBuilderRoute`
 * now mounts itself via `handlePreview` (byte-for-byte what
 * `node_modules/@payloadcms/next/dist/views/Document/index.js` does) — the same
 * provider whose value the built-in `PreviewButton` reads via
 * `usePreviewURL()`. `usePreviewURL` itself isn't part of the public client
 * export surface, but the context it reads is: `useLivePreviewContext()`
 * (exported from `@payloadcms/ui`) returns `{ previewURL, isPreviewEnabled }`
 * among other live-preview fields. So the iframe uses
 * `useLivePreviewContext().previewURL` directly — this is the same
 * server-computed, secret-bearing URL the stock Preview button opens, with
 * no client-side secret handling of our own. If it is missing for any reason
 * we fall back to a "save the page to preview it" placeholder.
 *
 * FORM HYDRATION — added when the builder moved to its own root view. The
 * Document view server-rendered the whole initial form state and handed it
 * down as a `formState` prop; a root view gets no such prop. `useBuilderFormState`
 * makes that one call on mount instead — see its docblock for why
 * `renderAllFields: true` there is not the same decision as `false` on the
 * onChange path below, and why `data` has to be passed.
 *
 * FORM `onChange` — added for Task 7 (BlockLibrary, add-block). Payload's
 * stock Edit view (`@payloadcms/ui`'s `views/Edit/index.tsx`) wires the
 * top-level `<Form>` with an `onChange` that debounces on every modified
 * field and re-fetches server-built form state via `getFormState`, merging
 * it back in. That's how newly-added block rows (inserted via
 * `addFieldRow` with no `subFieldState` — see BlockLibrary.tsx) get their
 * real sub-fields hydrated: the row starts as a placeholder
 * (`{ id, blockType, isLoading: true }` — see `fieldReducer.js`'s
 * `ADD_ROW` case) and this `onChange` fills it in a couple hundred ms
 * later, exactly as it does for the built-in Blocks field's own "Add"
 * button. Without it, a row added here would stay permanently unhydrated —
 * missing default field values — because this view renders its own
 * top-level `<Form>` rather than reusing Payload's Document Form, and
 * `<Form>` only gets this behavior when an `onChange` is explicitly passed.
 */
export default function PageBuilderView() {
  const { action, id, collectionSlug, docPermissions, getDocPreferences, initialData } =
    useDocumentInfo()
  const { previewURL } = useLivePreviewContext()
  const { getFormState } = useServerFunctions()

  // `PageBuilderRoute` only mounts this for an existing document, and creates
  // go to Payload's stock form (see EditRedirect) — but operation and HTTP
  // method still derive from `id` rather than being hardcoded to update/PATCH,
  // so a missing DocumentInfoProvider degrades the same way it always did
  // instead of silently PATCHing nothing (see task-4 review finding).
  const isCreate = !id
  const operation = isCreate ? 'create' : 'update'

  // Cancels the previous in-flight getFormState request when a new one
  // starts, mirroring the stock Edit view's own onChange handler
  // (`@payloadcms/ui`'s `views/Edit/index.tsx`, via its `handleAbortRef`
  // helper) — without this, two field edits in quick succession can race
  // and an older response can resolve after a newer one, clobbering the
  // form state the merchant is currently looking at.
  const abortRef = React.useRef<AbortController | null>(null)

  const onFormChange = React.useCallback(
    async ({ formState, submitted }: { formState: FormState; submitted?: boolean }): Promise<FormState> => {
      if (!collectionSlug) return formState
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const docPreferences = await getDocPreferences()
        const result = await getFormState({
          id,
          collectionSlug,
          docPermissions,
          docPreferences,
          formState,
          operation,
          renderAllFields: false,
          schemaPath: collectionSlug,
          signal: controller.signal,
          skipValidation: !submitted,
        })
        return result?.state ?? formState
      } catch {
        // A transient failure (network error, or the request above being
        // aborted by a subsequent edit) shouldn't wedge form-state sync —
        // fall back to the form state as it was passed in.
        return formState
      }
    },
    [collectionSlug, docPermissions, getDocPreferences, getFormState, id, operation],
  )

  // One-shot mount hydration of the initial form state. `renderAllFields: true`
  // lives inside the hook, and ONLY there — the onChange path above
  // deliberately keeps it false.
  const { failed: hydrationFailed, state: initialState } = useBuilderFormState({
    collectionSlug,
    data: initialData,
    docPermissions,
    getDocPreferences,
    getFormState,
    id,
    operation,
  })

  // `useDocumentInfo()` returns `{}` rather than throwing when there is no
  // provider above it, so a mis-wired mount would otherwise fail silently with
  // an empty builder. Say so instead.
  //
  // All three states below render BEFORE `PageBuilderShell` (and so before
  // `BuilderTopBar`), on a route that is full-bleed by design — no admin nav,
  // no header, nothing else on screen. Final-review Important 2: without a
  // way out here, a merchant whose `getFormState` call fails (or who's stuck
  // on the loading state) is stranded with zero UI to escape with. Each one
  // carries the same `BackToPagesLink` the topbar renders once the shell
  // mounts, so this and `BuilderTopBar` can't drift into two different exits.
  if (!collectionSlug || !initialData) {
    return (
      <div className="pb-boot">
        <BackToPagesLink className="pb-boot__back" />
        <p>The page builder could not load this document.</p>
      </div>
    )
  }

  if (hydrationFailed) {
    return (
      <div className="pb-boot">
        <BackToPagesLink className="pb-boot__back" />
        <p>The page builder could not load this page&rsquo;s fields.</p>
      </div>
    )
  }

  if (!initialState) {
    return (
      <div className="pb-boot">
        <BackToPagesLink className="pb-boot__back" />
        <p>Loading page builder&hellip;</p>
      </div>
    )
  }

  return (
    <OperationProvider operation={operation}>
      <Form
        action={action}
        initialState={initialState}
        isDocumentForm
        method={isCreate ? 'POST' : 'PATCH'}
        onChange={[onFormChange]}
      >
        <SelectionProvider>
          <PageBuilderShell previewURL={previewURL} />
        </SelectionProvider>
      </Form>
    </OperationProvider>
  )
}

/**
 * Preference key for the rails' persisted widths. Bumping the shape (adding a
 * field) is backwards compatible for existing readers since every value is
 * read individually and clamped; removing a field is not, and would need a
 * key bump.
 */
const RAIL_PREFERENCE_KEY = 'nb-builder-rails'

type RailPreference = { left?: number; right?: number }

// Mirrors LayersRail.tsx's own local `Row` — deliberately not shared, per that
// file's existing convention: each reader only ever needs `id`/`blockType`.
type Row = { id: string; blockType?: string }

// A stable empty-array fallback for when `layout.rows` isn't in form state
// yet. A fresh `?? []` literal would give `rows` (and everything derived from
// it below) a new reference every render, which is exactly the "changes on
// every render" `useCallback` deps warning is for.
const EMPTY_ROWS: Row[] = []

function PageBuilderShell({ previewURL }: { previewURL: string | undefined }) {
  const { selectedId, select } = useSelection()
  const [device, setDevice] = React.useState<DeviceKey>('desktop')

  // Selection-overlay handlers (Task 9). Reorder/duplicate/delete are
  // form-state operations this view already owns via the same `useForm()`
  // primitives `LayersRail` uses — see `useSelectionActions.ts` for why the
  // actual handler logic lives there (testability) and why "duplicate" is a
  // `dispatchFields({ type: 'DUPLICATE_ROW' })`, not `addFieldRow`.
  // `selectedIndex` is resolved from the same `layout.rows` the layers rail
  // reads, so both stay in lockstep with each other and with the frame's own
  // block order.
  //
  // Read BEFORE `usePreviewBridge` (Round 2, Task 3) because the bridge's
  // `onEditTarget` needs them: the same `fields` bag and the same `rows` array,
  // not a second subscription to the same store.
  const { moveFieldRow, dispatchFields, removeFieldRow, setModified } = useForm()
  const fields = (useFormFields(([f]) => f) ?? {}) as Record<string, unknown>
  const rows = ((fields.layout as { rows?: Row[] } | undefined)?.rows ?? EMPTY_ROWS) as Row[]

  // Round 2, Task 3 — in-place canvas text editing. The frame reports WHAT was
  // double-clicked (`data-nb-part` + the visible text); `useCanvasEdit` decides
  // which field, if any, that is, using the form state only this side holds.
  // See its docblock for why a null resolution opens nothing.
  const { edit, onEditTarget, closeEdit } = useCanvasEdit({ rows, fields })

  // `device` is passed straight through — the hook itself calls `measure()`
  // whenever it changes (see usePreviewBridge's docblock), so this view
  // doesn't need to call `measure` itself.
  const { iframeRef, patch, setScheme, reload, rects, hoveredId } = usePreviewBridge({
    onSelect: select,
    onEditTarget,
    device,
  })
  const { getPreference, setPreference } = usePreferences()
  // Bound the same way `BlockInspector` binds it — an explicit `path` on
  // `useField`, independent of where in the tree this runs — so `handleDuplicate`
  // can copy a source block's style entry onto its new row (final-review
  // Important 1: `DUPLICATE_ROW` copies content but not `blockStyles`, which is
  // a page-level map keyed by row id, entirely outside the duplicated row).
  const { value: blockStylesValue, setValue: setBlockStylesValue } =
    useField<Record<string, BlockStyle>>({ path: 'blockStyles' })
  const blockStyles = React.useMemo(() => asBlockStyleMap(blockStylesValue), [blockStylesValue])
  const { selectedBlockType, handleMove, handleDuplicate, handleDelete } = useSelectionActions({
    rows,
    selectedId,
    select,
    moveFieldRow,
    dispatchFields,
    removeFieldRow,
    setModified,
    blockStyles,
    setBlockStyles: setBlockStylesValue,
  })

  // Final-review Important 5 — the canvas iframe renders the SAVED draft
  // (`/api/preview` -> `getDraftPageBySlug`), and `reload()` is only ever
  // called from the variant-change effect in `BlockInspector`. A structural
  // edit from the canvas's own action tag (move/duplicate/delete) changes
  // form state and the layers rail immediately, but changes nothing visible
  // on the canvas — clicking "Move down" twice moves the block twice with no
  // on-canvas confirmation either happened. Reloading here unconditionally
  // would swap in the OLD saved draft, actively HIDING the pending edit
  // rather than confirming it — worse than the current silence. Marking the
  // canvas visibly stale is the minimum honest fix: it never claims the
  // canvas matches form state when a structural edit has made that untrue,
  // and the merchant can dismiss it once they've read it. It reappears on
  // the next structural edit regardless of the current value, since each one
  // makes the canvas stale again independent of whether the last notice was
  // dismissed.
  const [previewStale, setPreviewStale] = React.useState(false)
  const markPreviewStale = React.useCallback(() => setPreviewStale(true), [])
  const dismissPreviewStale = React.useCallback(() => setPreviewStale(false), [])
  const handleMoveAndMarkStale = React.useCallback(
    (dir: 'up' | 'down') => {
      handleMove(dir)
      markPreviewStale()
    },
    [handleMove, markPreviewStale],
  )
  const handleDuplicateAndMarkStale = React.useCallback(() => {
    handleDuplicate()
    markPreviewStale()
  }, [handleDuplicate, markPreviewStale])
  const handleDeleteAndMarkStale = React.useCallback(() => {
    handleDelete()
    markPreviewStale()
  }, [handleDelete, markPreviewStale])

  const [leftWidth, setLeftWidth] = React.useState<number>(RAIL_DEFAULT.left)
  const [rightWidth, setRightWidth] = React.useState<number>(RAIL_DEFAULT.right)
  const [leftCollapsed, setLeftCollapsed] = React.useState(false)
  const [rightCollapsed, setRightCollapsed] = React.useState(false)

  const gridRef = React.useRef<HTMLDivElement>(null)
  const [gridWidth, setGridWidth] = React.useState(0)

  // Measures the slot the canvas actually has, so `CanvasStage` scales against
  // real layout rather than a value computed once at mount. `ResizeObserver`
  // is not implemented in jsdom — any test that renders this shell must stub
  // it (see CanvasStage's sibling shell test, if one is added) rather than
  // this effect degrading gracefully, which would hide a real production
  // resize path behind a test-only branch.
  React.useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setGridWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Reads the persisted rail widths once on mount. Re-clamped against the
  // *current* grid width, not just each rail's own minimum: a width stored
  // from a wide monitor must not be able to squeeze the canvas to nothing on
  // a laptop. No one-shot guard is needed here (contrast
  // `useBuilderFormState`'s deliberate no-cleanup comment) — a StrictMode
  // double-run just re-reads the same cached preference and re-clamps to the
  // same result, which is idempotent, not harmful.
  React.useEffect(() => {
    let active = true
    void (async () => {
      const stored = (await getPreference<RailPreference>(RAIL_PREFERENCE_KEY)) ?? undefined
      if (!active || !stored) return
      const total = gridRef.current?.getBoundingClientRect().width ?? 0
      if (typeof stored.left === 'number') setLeftWidth(clampRailWidth('left', stored.left, total))
      if (typeof stored.right === 'number') setRightWidth(clampRailWidth('right', stored.right, total))
    })()
    return () => {
      active = false
    }
  }, [getPreference])

  const persistRails = React.useCallback(
    (next: RailPreference) => {
      void setPreference(RAIL_PREFERENCE_KEY, next, true)
    },
    [setPreference],
  )

  const effectiveLeft = leftCollapsed ? RAIL_COLLAPSED_WIDTH : leftWidth
  const effectiveRight = rightCollapsed ? RAIL_COLLAPSED_WIDTH : rightWidth
  const slotWidth = canvasSlotWidth(gridWidth, effectiveLeft, effectiveRight)
  const { zoomPercent } = fitCanvas(device, slotWidth)

  // Mirrors the `max` clampRailWidth computes internally, purely for the
  // grips' `aria-valuemax` — assistive tech announcing a sensible upper bound
  // matters more than the exact edge case, so this doesn't chase
  // clampRailWidth's own `max < min` fallback.
  const leftMax = Math.max(RAIL_MIN.left, gridWidth - RAIL_MIN.right - CANVAS_MIN_WIDTH)
  const rightMax = Math.max(RAIL_MIN.right, gridWidth - RAIL_MIN.left - CANVAS_MIN_WIDTH)

  // Grips are only ever rendered while their rail is expanded (see the JSX
  // below), so `useRailGrip` itself doesn't need to know about `collapsed`.
  const leftGrip = useRailGrip({
    side: 'left',
    width: leftWidth,
    setWidth: setLeftWidth,
    gridRef,
    onCommit: (width) => persistRails({ left: width }),
  })
  const rightGrip = useRailGrip({
    side: 'right',
    width: rightWidth,
    setWidth: setRightWidth,
    gridRef,
    onCommit: (width) => persistRails({ right: width }),
  })

  return (
    <div className="pb-root">
      <BuilderTopBar device={device} onDevice={setDevice} zoomPercent={zoomPercent} selectedId={selectedId} />

      <div
        className="pb-grid"
        ref={gridRef}
        style={
          {
            '--pb-rail-left': `${effectiveLeft}px`,
            '--pb-rail-right': `${effectiveRight}px`,
          } as React.CSSProperties
        }
      >
        <aside
          className={`pb-pane pb-pane--left${leftCollapsed ? ' pb-pane--collapsed' : ''}`}
          aria-label="Blocks"
        >
          {leftCollapsed ? (
            <button
              type="button"
              className="pb-rail-collapse-toggle"
              aria-label="Expand blocks panel"
              onClick={() => setLeftCollapsed(false)}
            >
              <span aria-hidden="true">&raquo;</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="pb-rail-collapse-toggle pb-rail-collapse-toggle--inline"
                aria-label="Collapse blocks panel"
                onClick={() => setLeftCollapsed(true)}
              >
                <span aria-hidden="true">&laquo;</span>
              </button>
              {/* Collapsible, open by default: title is required, so a brand-new
                  page needs it visible immediately or Save/Publish dead-ends on
                  a hidden field (final-review Finding 1). */}
              <details className="nb-pb-settings-drawer" open>
                <summary className="nb-pb-settings-drawer__summary">Page settings</summary>
                <PageSettings />
              </details>
              <LayersRail />
              {/* Only rendered while expanded: a collapsed rail has a fixed
                  width (RAIL_COLLAPSED_WIDTH) with nothing to drag it to —
                  the way back to a draggable width is the expand button
                  above, not this grip. */}
              <div
                className="pb-rail-grip pb-rail-grip--left"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize blocks panel"
                aria-valuenow={effectiveLeft}
                aria-valuemin={RAIL_MIN.left}
                aria-valuemax={leftMax}
                tabIndex={0}
                {...leftGrip}
              />
            </>
          )}
        </aside>

        <main className="pb-pane pb-pane--center">
          <CanvasStage
            previewURL={previewURL}
            device={device}
            slotWidth={slotWidth}
            iframeRef={iframeRef}
            rects={rects}
            selectedId={selectedId}
            hoveredId={hoveredId}
            blockType={selectedBlockType ? labelForBlockType(selectedBlockType) : undefined}
            onMove={handleMoveAndMarkStale}
            onDuplicate={handleDuplicateAndMarkStale}
            onDelete={handleDeleteAndMarkStale}
            stale={previewStale}
            onDismissStale={dismissPreviewStale}
            edit={edit}
            onCloseEdit={closeEdit}
          />
        </main>

        <aside
          className={`pb-pane pb-pane--right${rightCollapsed ? ' pb-pane--collapsed' : ''}`}
          aria-label="Inspector"
        >
          {rightCollapsed ? (
            <button
              type="button"
              className="pb-rail-collapse-toggle"
              aria-label="Expand inspector panel"
              onClick={() => setRightCollapsed(false)}
            >
              <span aria-hidden="true">&laquo;</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="pb-rail-collapse-toggle pb-rail-collapse-toggle--inline"
                aria-label="Collapse inspector panel"
                onClick={() => setRightCollapsed(true)}
              >
                <span aria-hidden="true">&raquo;</span>
              </button>
              <BlockInspector patch={patch} setScheme={setScheme} reload={reload} />
              {/* Only rendered while expanded — see the left rail's grip for why. */}
              <div
                className="pb-rail-grip pb-rail-grip--right"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize inspector panel"
                aria-valuenow={effectiveRight}
                aria-valuemin={RAIL_MIN.right}
                aria-valuemax={rightMax}
                tabIndex={0}
                {...rightGrip}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
