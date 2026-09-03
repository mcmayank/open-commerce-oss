/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CanvasStage } from './CanvasStage'

// `CanvasStage` now renders `CanvasTextEditor`, which imports `useField` from
// `@payloadcms/ui`. That barrel pulls a `.css` file Node's ESM loader rejects
// ("Unknown file extension \".css\""), so importing it for real would fail this
// whole file at load time. The mock keeps the barrel out of the graph; what
// `useField` actually does with the path is CanvasTextEditor.test.tsx's job.
const setValue = vi.fn()
vi.mock('@payloadcms/ui', () => ({ useField: () => ({ setValue }) }))

afterEach(cleanup)

const noop = () => {}

describe('CanvasStage', () => {
  it('renders the iframe at the device width, not the slot width', () => {
    render(
      <CanvasStage
        previewURL="https://shop.example.com/x"
        device="desktop"
        slotWidth={800}
        iframeRef={React.createRef()}
        rects={[]}
        selectedId={null}
        hoveredId={null}
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    const frame = screen.getByTitle('Storefront preview')
    // Presence guard: a missing element would make every style assertion below
    // vacuously pass. See the repo's vacuous-assertion history.
    expect(frame).toBeTruthy()
    expect(frame.style.width).toBe('1280px')
  })

  it('scales the frame down to fit the slot', () => {
    render(
      <CanvasStage
        previewURL="https://shop.example.com/x"
        device="desktop"
        slotWidth={800}
        iframeRef={React.createRef()}
        rects={[]}
        selectedId={null}
        hoveredId={null}
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    const wrapper = screen.getByTestId('nb-canvas-viewport')
    expect(wrapper).toBeTruthy()
    expect(wrapper.style.transform).toBe('scale(0.625)')
  })

  it('does not scale a mobile canvas up to fill a wide slot', () => {
    render(
      <CanvasStage
        previewURL="https://shop.example.com/x"
        device="mobile"
        slotWidth={900}
        iframeRef={React.createRef()}
        rects={[]}
        selectedId={null}
        hoveredId={null}
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    expect(screen.getByTestId('nb-canvas-viewport').style.transform).toBe('scale(1)')
  })

  it('shows the save-first placeholder instead of an iframe when there is no preview URL', () => {
    render(
      <CanvasStage
        previewURL={undefined}
        device="desktop"
        slotWidth={800}
        iframeRef={React.createRef()}
        rects={[]}
        selectedId={null}
        hoveredId={null}
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    expect(screen.getByText(/save this page/i)).toBeTruthy()
    expect(screen.queryByTitle('Storefront preview')).toBeNull()
  })

  it('positions the selection box using the SAME scale it applies to the iframe, not the raw rect', () => {
    render(
      <CanvasStage
        previewURL="https://shop.example.com/x"
        device="desktop"
        slotWidth={800}
        iframeRef={React.createRef()}
        rects={[{ blockId: 'a', top: 100, left: 0, width: 1280, height: 200 }]}
        selectedId="a"
        hoveredId={null}
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    const box = screen.getByTestId('nb-selection-box')
    expect(box).toBeTruthy()
    // slotWidth 800 / deviceWidth 1280 = the same 0.625 scale the transform
    // above uses — a divergent scale here is exactly the "overlay lands
    // somewhere misleading" failure mode this task's self-review calls out.
    expect(box.style.top).toBe(`${100 * 0.625}px`)
  })

  it('does not render a selection box when nothing is selected', () => {
    render(
      <CanvasStage
        previewURL="https://shop.example.com/x"
        device="desktop"
        slotWidth={800}
        iframeRef={React.createRef()}
        rects={[{ blockId: 'a', top: 100, left: 0, width: 1280, height: 200 }]}
        selectedId={null}
        hoveredId={null}
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    expect(screen.queryByTestId('nb-selection-box')).toBeNull()
  })

  // Final-review Important 6: `.pb-canvas__viewport` painted at
  // `height * scale` while occupying `height` of layout space, leaving
  // `(1 - scale)` of the pane bare below it. Inflating the layout height by
  // `1 / scale` makes the post-transform PAINTED height land back on 100%.
  it('inflates the viewport height by 1/scale so the scaled paint fills the pane, not (1 - scale) less', () => {
    render(
      <CanvasStage
        previewURL="https://shop.example.com/x"
        device="desktop"
        slotWidth={800}
        iframeRef={React.createRef()}
        rects={[]}
        selectedId={null}
        hoveredId={null}
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    const wrapper = screen.getByTestId('nb-canvas-viewport')
    // scale is 800/1280 = 0.625 (see the sibling "scales the frame down" test
    // above) — 100/0.625 = 160%.
    expect(wrapper.style.height).toBe(`${100 / 0.625}%`)
  })

  it('does not inflate the viewport height when the canvas is already at full scale', () => {
    render(
      <CanvasStage
        previewURL="https://shop.example.com/x"
        device="mobile"
        slotWidth={900}
        iframeRef={React.createRef()}
        rects={[]}
        selectedId={null}
        hoveredId={null}
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    // scale is 1 here (see "does not scale a mobile canvas up" above) —
    // 100/1 = 100%, i.e. unchanged from before this fix.
    expect(screen.getByTestId('nb-canvas-viewport').style.height).toBe('100%')
  })

  // Final-review Important 5: the canvas shows the SAVED draft, and a
  // structural edit (move/duplicate/delete) doesn't touch it — this banner is
  // the honest minimum: say so, rather than silently looking current.
  describe('stale-preview banner', () => {
    it('renders nothing extra when stale is not set', () => {
      render(
        <CanvasStage
          previewURL="https://shop.example.com/x"
          device="desktop"
          slotWidth={800}
          iframeRef={React.createRef()}
          rects={[]}
          selectedId={null}
          hoveredId={null}
          onMove={noop}
          onDuplicate={noop}
          onDelete={noop}
        />,
      )
      expect(screen.queryByRole('status')).toBeNull()
    })

    it('shows the out-of-date notice when stale is true', () => {
      render(
        <CanvasStage
          previewURL="https://shop.example.com/x"
          device="desktop"
          slotWidth={800}
          iframeRef={React.createRef()}
          rects={[]}
          selectedId={null}
          hoveredId={null}
          onMove={noop}
          onDuplicate={noop}
          onDelete={noop}
          stale
          onDismissStale={noop}
        />,
      )
      expect(screen.getByRole('status')).toBeTruthy()
      expect(screen.getByText(/out of date/i)).toBeTruthy()
    })

    it('calls onDismissStale when the dismiss control is clicked', () => {
      const onDismissStale = vi.fn()
      render(
        <CanvasStage
          previewURL="https://shop.example.com/x"
          device="desktop"
          slotWidth={800}
          iframeRef={React.createRef()}
          rects={[]}
          selectedId={null}
          hoveredId={null}
          onMove={noop}
          onDuplicate={noop}
          onDelete={noop}
          stale
          onDismissStale={onDismissStale}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
      expect(onDismissStale).toHaveBeenCalledTimes(1)
    })

    it('never lies about the canvas being current: the notice never appears while stale is falsy, even with a dismiss handler wired up', () => {
      render(
        <CanvasStage
          previewURL="https://shop.example.com/x"
          device="desktop"
          slotWidth={800}
          iframeRef={React.createRef()}
          rects={[]}
          selectedId={null}
          hoveredId={null}
          onMove={noop}
          onDuplicate={noop}
          onDelete={noop}
          stale={false}
          onDismissStale={noop}
        />,
      )
      expect(screen.queryByRole('status')).toBeNull()
    })
  })

  // ── In-place text editor (Round 2, Task 3) ───────────────────────────────
  describe('in-place text editor', () => {
    const edit = {
      path: 'layout.0.heading',
      initialValue: 'Fresh bread',
      rect: { top: 10, left: 20, width: 300, height: 40 },
    }

    it('renders nothing extra when there is no edit target', () => {
      render(
        <CanvasStage
          previewURL="https://shop.example.com/x"
          device="desktop"
          slotWidth={800}
          iframeRef={React.createRef()}
          rects={[]}
          selectedId={null}
          hoveredId={null}
          onMove={noop}
          onDuplicate={noop}
          onDelete={noop}
        />,
      )
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('renders the editor inside the overlay layer, in the same scaled space as the selection boxes', () => {
      const { container } = render(
        <CanvasStage
          previewURL="https://shop.example.com/x"
          device="desktop"
          slotWidth={800}
          iframeRef={React.createRef()}
          rects={[]}
          selectedId={null}
          hoveredId={null}
          onMove={noop}
          onDuplicate={noop}
          onDelete={noop}
          edit={edit}
          onCloseEdit={noop}
        />,
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      // Presence guard before anything is read off it — see the note above.
      expect(input).toBeTruthy()
      expect(input.value).toBe('Fresh bread')

      const layer = container.querySelector('.pb-canvas__overlay-layer')
      expect(layer).toBeTruthy()
      // Sharing the overlay layer is the whole positioning contract: that layer
      // sits OUTSIDE `.pb-canvas__viewport`'s CSS transform, which is why the
      // editor multiplies its own rect by `scale` exactly as SelectionOverlay
      // does. Rendered anywhere else it would land at scale-squared.
      expect(layer?.contains(input)).toBe(true)
    })

    it('scales the editor box by the same factor the canvas is scaled by', () => {
      render(
        <CanvasStage
          previewURL="https://shop.example.com/x"
          device="desktop"
          // 1280px desktop into a 640px slot -> scale 0.5.
          slotWidth={640}
          iframeRef={React.createRef()}
          rects={[]}
          selectedId={null}
          hoveredId={null}
          onMove={noop}
          onDuplicate={noop}
          onDelete={noop}
          edit={edit}
          onCloseEdit={noop}
        />,
      )
      const box = screen.getByRole('textbox').parentElement as HTMLElement
      expect(box).toBeTruthy()
      expect(box.style.top).toBe('5px')
      expect(box.style.left).toBe('10px')
      expect(box.style.width).toBe('150px')
    })
  })
})
