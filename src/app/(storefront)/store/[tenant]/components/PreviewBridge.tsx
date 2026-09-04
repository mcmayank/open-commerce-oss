'use client'

import { useEffect } from 'react'
import { parseBridgeMessage } from '@/lib/preview-bridge/protocol'
import { sectionVars, type SectionScheme } from '@/blocks/lib/colorScheme'

// Real browsers all implement CSS.escape natively. jsdom (our unit-test
// environment) does not define a `CSS` global at all, so this falls back to
// a minimal manual escape for tests — it's never exercised in production.
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`)
}

/**
 * Draft-only storefront bridge for the Phase 3b page builder.
 *
 * Renders nothing. While mounted it:
 *  - announces readiness to the parent builder frame on mount,
 *  - posts the id of whichever `[data-nb-block-id]` wrapper was clicked, and
 *  - applies live `--bs-*` CSS var patches pushed down from the builder onto
 *    that block's wrapper.
 *
 * Only ever rendered inside the `isDraft` branch of the storefront page —
 * never for normal visitors.
 */
export function PreviewBridge(): null {
  useEffect(() => {
    const origin = window.location.origin

    // Tracks, per block, which `--bs-*` custom properties THIS bridge has
    // applied so far. On the next patch for that block we can tell which
    // vars dropped out (e.g. a control reset to Default, so
    // `varsForStyle(next)` no longer includes it) and remove them — a plain
    // `setProperty` loop over the new vars only ever adds/overwrites, so a
    // stale var would otherwise linger in the preview until reload.
    const appliedByBlock = new Map<string, Set<string>>()

    // Mirrors `appliedByBlock` above, but for the `--section-*` vars (+ band
    // background/color) a `scheme` message applies — tracked separately so a
    // scheme change never clobbers (or is clobbered by) a `--bs-*` style patch
    // on the same block.
    const appliedSchemeByBlock = new Map<string, Set<string>>()

    // Reports each block's RAW viewport-relative rect — i.e. exactly what
    // `getBoundingClientRect()` returns, with no scroll offset added back in.
    // The builder's overlay is anchored to the iframe's fixed on-screen box
    // in the PARENT page, so it needs each block's CURRENT on-screen
    // position, not a scroll-invariant document-absolute one (an earlier
    // version of this function added `window.scrollY`/`scrollX` back, which
    // produces a value that never changes no matter how far the frame
    // scrolls — exactly wrong for an overlay that has to track the visible
    // position). This is what makes the `scroll` listener below meaningful:
    // scrolling genuinely changes `getBoundingClientRect()`'s result, and
    // this handler reports that fresh, so the overlay tracks it.
    const measureAll = () => {
      const rects = Array.from(
        document.querySelectorAll<HTMLElement>('[data-nb-block-id]'),
      )
        .filter((el) => el.dataset.nbBlockId)
        .map((el) => {
          const r = el.getBoundingClientRect()
          return {
            blockId: el.dataset.nbBlockId as string,
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          }
        })
      window.parent.postMessage({ source: 'nb-preview', type: 'rects', rects }, origin)
    }

    // Coalesce bursts of scroll/resize into one frame — a rects message per
    // scroll event would flood the bridge and the overlay would lag behind.
    let raf = 0
    const scheduleMeasure = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        measureAll()
      })
    }

    const handleHover = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nb-block-id]')
      const id = el?.dataset.nbBlockId || null
      window.parent.postMessage({ source: 'nb-preview', type: 'hover', blockId: id }, origin)
    }

    // Final-review Important 4: `hover: null` was previously only ever posted
    // by `handleHover` above firing on a non-block element INSIDE the frame.
    // Moving the pointer from a block straight out of the iframe — onto a
    // rail, the browser chrome, anywhere off-document — fires no further
    // `mouseover` in here at all, so `hoveredId` in the builder stayed stuck
    // on the last block the pointer was over, with the dashed hover outline
    // drawn indefinitely on a block the pointer is nowhere near. `mouseleave`
    // on `document` fires exactly when the pointer leaves the whole document
    // (it doesn't bubble, but the target here already IS `document`, so a
    // plain listener — no capture flag needed — catches it).
    const handlePointerLeaveDocument = () => {
      window.parent.postMessage({ source: 'nb-preview', type: 'hover', blockId: null }, origin)
    }

    // Announce readiness to the parent builder frame. When this page is
    // opened directly (not inside the builder's iframe), window.parent is
    // window itself — posting to ourselves here is inert, so it's safe to
    // skip it as a small optimization rather than a correctness guard.
    if (window.parent !== window) {
      window.parent.postMessage({ source: 'nb-preview', type: 'ready' }, origin)
      measureAll()
    }

    const handleClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nb-block-id]')
      if (!el) return
      const id = el.dataset.nbBlockId
      // An empty data-nb-block-id (e.g. a wrapper rendered before its real id
      // is assigned) isn't a meaningful selection — don't post it.
      if (!id) return
      // Inside the builder a click on a block MEANS "select this block", so the
      // storefront's own default action must not also fire: blocks are full of
      // links (hero CTAs, product cards) and buttons, and following one
      // navigates the preview away from the page being edited. Scoped to
      // clicks that actually hit a block wrapper, so storefront chrome around
      // the blocks still behaves normally. `preventDefault` only — the event
      // still propagates, so nothing else silently loses its listener.
      e.preventDefault()
      window.parent.postMessage(
        { source: 'nb-preview', type: 'select', blockId: id },
        origin,
      )
    }

    // Double-click inside a block = "edit this text in place". Mirrors
    // handleClick's structure: find the block wrapper, then the nearest marked
    // text part inside it. The part is a STYLING hook (nb-hooks/1) being reused
    // for authoring; that is safe because the builder re-checks the text against
    // form state before it writes anything (resolveEditField).
    const handleDoubleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const wrapper = target.closest<HTMLElement>('[data-nb-block-id]')
      if (!wrapper) return
      const id = wrapper.dataset.nbBlockId
      if (!id) return
      const partEl = target.closest<HTMLElement>('[data-nb-part]')
      if (!partEl || !wrapper.contains(partEl)) return
      const part = partEl.dataset.nbPart
      if (!part) return
      // Suppress the browser's word-selection so the builder's input, not the
      // frame, owns the caret from here.
      e.preventDefault()
      const r = partEl.getBoundingClientRect()
      window.parent.postMessage(
        {
          source: 'nb-preview',
          type: 'edit-target',
          blockId: id,
          part,
          text: partEl.textContent ?? '',
          rect: { top: r.top, left: r.left, width: r.width, height: r.height },
        },
        origin,
      )
    }

    const handleMessage = (e: MessageEvent) => {
      const msg = parseBridgeMessage(e.data, e.origin, origin)
      if (!msg) return

      if (msg.type === 'scheme') {
        const wrapper = document.querySelector<HTMLElement>(
          `[data-nb-block-id="${cssEscape(msg.blockId)}"]`,
        )
        if (!wrapper) return
        // '' (theme default, unset) and 'default' both mean "no band" — only
        // a concrete non-default scheme gets the attribute the storefront's
        // own CSS keys off of.
        if (msg.scheme === '' || msg.scheme === 'default') {
          wrapper.removeAttribute('data-scheme')
        } else {
          wrapper.setAttribute('data-scheme', msg.scheme)
        }
        const prev = appliedSchemeByBlock.get(msg.blockId) ?? new Set<string>()
        const nextKeys = new Set<string>()
        // '' (theme default) applies no vars of its own — it just clears
        // whatever this bridge previously set, below. 'default' still runs
        // through sectionVars() so its `--section-*` vars land (it just
        // never carries a background/color band, per sectionVars('default')).
        if (msg.scheme !== '') {
          const vars = sectionVars(msg.scheme as SectionScheme)
          for (const [k, v] of Object.entries(vars)) {
            if (typeof v !== 'string') continue
            wrapper.style.setProperty(k, v)
            nextKeys.add(k)
          }
        }
        for (const k of prev) {
          if (!nextKeys.has(k)) wrapper.style.removeProperty(k)
        }
        appliedSchemeByBlock.set(msg.blockId, nextKeys)
        return
      }

      if (msg.type === 'measure') {
        measureAll()
        return
      }

      if (msg.type !== 'patch') return
      const wrapper = document.querySelector<HTMLElement>(
        `[data-nb-block-id="${cssEscape(msg.blockId)}"]`,
      )
      if (!wrapper) return
      // The builder only ever sends block-style vocabulary vars — restrict the
      // patch surface to that contract rather than trusting arbitrary keys.
      const prev = appliedByBlock.get(msg.blockId) ?? new Set<string>()
      const nextKeys = new Set<string>()
      for (const [k, v] of Object.entries(msg.vars)) {
        if (!k.startsWith('--bs-')) continue
        wrapper.style.setProperty(k, v)
        nextKeys.add(k)
      }
      // Clear vars this bridge set on a prior patch that are no longer
      // present, so resetting a control to Default actually clears it in
      // the live preview instead of leaving the last value stuck.
      //
      // Known edge case: if a store-wide `blockStyleDefaults` value exists
      // for a control the merchant unsets at the instance level, the live
      // preview falls back to the block's hardcoded default rather than the
      // store default until reload — this bridge only tracks vars it
      // applied itself, not server-rendered store defaults baked into the
      // initial HTML. The form state (what gets saved) stays correct
      // either way; only the transient preview render is affected.
      for (const k of prev) {
        if (!nextKeys.has(k)) wrapper.style.removeProperty(k)
      }
      appliedByBlock.set(msg.blockId, nextKeys)
    }

    // Final-review Important 3: `measureAll` ran on mount, `scroll`, `resize`
    // and an explicit `measure` request — never on anything that changes a
    // block's SIZE without the window itself resizing. Two concrete gaps that
    // left: (a) the mount measurement (and the `ready` -> `measure` round
    // trip) both land before images have finished laying out, so the first
    // selection outline on any image-bearing page is wrong until something
    // else happens to trigger a re-measure; (b) the inspector's primary job
    // is patching `--bs-*` spacing vars, and a padding change resizes the
    // block with no window-level event at all, leaving the outline detached
    // from the block it names. A `ResizeObserver` on the document root and a
    // `window.load` listener close both, funnelled into the same
    // `scheduleMeasure` so they inherit its rAF coalescing rather than each
    // firing their own `measureAll` burst.
    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(document.documentElement)
    window.addEventListener('load', scheduleMeasure)

    document.addEventListener('click', handleClick, true)
    document.addEventListener('dblclick', handleDoubleClick)
    document.addEventListener('mouseover', handleHover, true)
    document.addEventListener('mouseleave', handlePointerLeaveDocument)
    window.addEventListener('scroll', scheduleMeasure, { passive: true })
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('message', handleMessage)

    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('dblclick', handleDoubleClick)
      document.removeEventListener('mouseover', handleHover, true)
      document.removeEventListener('mouseleave', handlePointerLeaveDocument)
      window.removeEventListener('scroll', scheduleMeasure)
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('load', scheduleMeasure)
      window.removeEventListener('message', handleMessage)
      resizeObserver.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
