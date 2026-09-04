'use client'

import React from 'react'
import { useFormFields, useFormModified, SaveDraftButton, PublishButton } from '@payloadcms/ui'
import { DEVICE_WIDTHS, type DeviceKey } from '@/lib/page-builder/canvas-fit'
import { BackToPagesLink } from './BackToPagesLink'

const DEVICE_LABELS: Record<DeviceKey, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
}

/**
 * The builder's top bar.
 *
 * Carries the "← Pages" back link that Task 5's `PageBuilderShell` used to
 * render inline, now factored into `BackToPagesLink` (final-review
 * Important 2) so this topbar and the `pb-boot` states in `PageBuilderView`
 * — which render BEFORE this topbar mounts — share one derivation of the
 * href rather than two that could drift. See `BackToPagesLink`'s docblock for
 * why this is the ONLY way out of the builder (the route is full-bleed;
 * `AdminNav`/`AdminHeader` never mount) and why the href is derived via
 * `formatAdminURL` off `useConfig()` rather than hardcoded.
 *
 * Title and draft/changes status are read live off the form (`useFormFields`
 * / `useFormModified`) rather than passed as props, the same pattern
 * `LayersRail` and `BlockInspector` use for `layout.rows` — this
 * component mounts inside the same `<Form>` tree, so both are always
 * available. `_status` is a real (if UI-hidden) field on any collection with
 * `versions.drafts` enabled (`payload/dist/versions/baseFields.js`), so it is
 * on the same top-level path as any other field.
 *
 * `device`/`onDevice`/`zoomPercent` stay props: they are `PageBuilderShell`
 * state (the device drives `CanvasStage`, which lives in the pane below, not
 * here) and the shell's own `fitCanvas` call, not anything this component
 * could derive on its own.
 */
export function BuilderTopBar({
  device,
  onDevice,
  zoomPercent,
  selectedId,
}: {
  device: DeviceKey
  onDevice: (device: DeviceKey) => void
  zoomPercent: number
  selectedId?: string | null
}) {
  const title = useFormFields(([fields]) => fields?.title?.value) as string | undefined
  const status = useFormFields(([fields]) => fields?._status?.value) as string | undefined
  const modified = useFormModified()

  const statusModifier = modified ? 'modified' : status === 'published' ? 'published' : 'draft'
  const statusLabel = modified ? 'Unsaved changes' : status === 'published' ? 'Published' : 'Draft'

  return (
    <div className="pb-topbar">
      <div className="pb-topbar__group">
        {/* The only way out. The builder is full-bleed by design, which means
            AdminNav and AdminHeader genuinely do not mount — they live inside
            DefaultTemplate — so without this there is no exit at all. Browser
            Back only appears to work because EditRedirect uses
            `router.replace`, which collapses the edit URL out of history;
            that is incidental and no help to a bookmark or a shared link. */}
        <BackToPagesLink />
        <span className="pb-topbar__title">{title || 'Page builder'}</span>
        <span className={`pb-topbar__status pb-topbar__status--${statusModifier}`}>{statusLabel}</span>
        {selectedId ? <span className="pb-topbar__selection">Selected: {selectedId}</span> : null}
      </div>
      <div className="pb-topbar__group">
        <div className="pb-device-toggle" role="group" aria-label="Preview device size">
          {(Object.keys(DEVICE_WIDTHS) as DeviceKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`pb-device-toggle__btn${device === key ? ' pb-device-toggle__btn--active' : ''}`}
              aria-pressed={device === key}
              onClick={() => onDevice(key)}
            >
              {DEVICE_LABELS[key]}
            </button>
          ))}
        </div>
        <span className="pb-topbar__zoom" aria-live="polite">
          {zoomPercent}%
        </span>
        <SaveDraftButton />
        <PublishButton />
      </div>
    </div>
  )
}
