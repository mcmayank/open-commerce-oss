'use client'

import * as React from 'react'
import { useField } from '@payloadcms/ui'

/**
 * The in-place text editor drawn over the canvas.
 *
 * A plain controlled `<input>`, NOT `contentEditable` inside the preview frame.
 * The frame is a different document rendering published markup; making it
 * editable would mean an IME- and undo-sensitive second editing surface whose
 * value has to be marshalled back across a postMessage boundary anyway. An input
 * positioned over the text reads as in-place to the merchant and keeps every
 * keystroke inside the admin document.
 *
 * `useField({ path })` is the whole point: `path` is `layout.<rowIndex>.<field>`
 * (built by `fieldPath`, which composes the same `blockRowPath` the inspector
 * hands `RenderFields` as its `parentPath`), the SAME form-state entry the
 * inspector's own input for that field binds. A canvas edit and an inspector
 * edit are therefore literally the same write, so drafts, validation and
 * versions cannot diverge. Never replace this with a direct `dispatchFields`
 * call or a bridge message that mutates the preview.
 */
export function CanvasTextEditor({
  path,
  initialValue,
  rect,
  scale,
  onClose,
}: {
  path: string
  initialValue: string
  rect: { top: number; left: number; width: number; height: number }
  scale: number
  onClose: () => void
}) {
  const { setValue } = useField<string>({ path })
  const [draft, setDraft] = React.useState(initialValue)
  const inputRef = React.useRef<HTMLInputElement>(null)
  // Guards the blur-commit from running a second time after Enter or Escape has
  // already closed the editor — blurring is a consequence of unmounting.
  const settled = React.useRef(false)

  React.useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const commit = () => {
    if (settled.current) return
    settled.current = true
    // An unchanged value must not be written: it would dirty the form and
    // create a draft the merchant never asked for.
    if (draft !== initialValue) setValue(draft)
    onClose()
  }

  const cancel = () => {
    if (settled.current) return
    settled.current = true
    onClose()
  }

  return (
    <div
      className="pb-canvas-text-editor"
      style={{
        position: 'absolute',
        top: rect.top * scale,
        left: rect.left * scale,
        width: rect.width * scale,
        minHeight: rect.height * scale,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={draft}
        aria-label="Edit text"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
      />
    </div>
  )
}
