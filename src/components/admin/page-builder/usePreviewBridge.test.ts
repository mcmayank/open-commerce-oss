/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { usePreviewBridge } from './usePreviewBridge'
import type { DeviceKey } from '@/lib/page-builder/canvas-fit'

// Without this, `renderHook` from an earlier test is never unmounted, so its
// window `message` listener (installed with an empty-deps effect, by design —
// see the hook's own docblock) stays live for the rest of the file. That was
// harmless while `onReady` only called test stubs; now that it also calls
// `measure()` (Task 9), a later test's `ready` dispatch reaches EVERY prior
// test's stale listener too, and one of those (the `reload()` test, whose
// stubbed `iframeRef.current` has no `postMessage`) throws.
afterEach(cleanup)

describe('usePreviewBridge', () => {
  it('calls onSelect when a valid select message arrives', () => {
    const onSelect = vi.fn()
    renderHook(() => usePreviewBridge({ onSelect }))
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-preview', type: 'select', blockId: 'blk_7' },
    })))
    expect(onSelect).toHaveBeenCalledWith('blk_7')
  })

  it('patch() posts to the iframe contentWindow', () => {
    const { result } = renderHook(() => usePreviewBridge({ onSelect: vi.fn() }))
    const post = vi.fn()
    // @ts-expect-error minimal stub
    result.current.iframeRef.current = { contentWindow: { postMessage: post } }
    act(() => result.current.patch('blk_1', { '--bs-heading-size': '2rem' }))
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'nb-builder', type: 'patch', blockId: 'blk_1' }),
      window.location.origin,
    )
  })

  it('setScheme() posts a scheme message to the iframe contentWindow', () => {
    const { result } = renderHook(() => usePreviewBridge({ onSelect: vi.fn() }))
    const post = vi.fn()
    // @ts-expect-error minimal stub
    result.current.iframeRef.current = { contentWindow: { postMessage: post } }
    act(() => result.current.setScheme('blk_2', 'muted'))
    expect(post).toHaveBeenCalledWith(
      { source: 'nb-builder', type: 'scheme', blockId: 'blk_2', scheme: 'muted' },
      window.location.origin,
    )
  })

  it('reload() reloads the iframe contentWindow location', () => {
    const { result } = renderHook(() => usePreviewBridge({ onSelect: vi.fn() }))
    const reload = vi.fn()
    // @ts-expect-error minimal stub
    result.current.iframeRef.current = { contentWindow: { location: { reload } } }
    act(() => result.current.reload())
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('uses the LATEST onSelect after a re-render, not the one captured on mount', () => {
    // The window listener is installed once with [] deps, so a naively captured
    // `opts` would go stale and keep calling the first render's callback — the
    // selection would silently stop updating after any parent re-render.
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ onSelect }) => usePreviewBridge({ onSelect }), {
      initialProps: { onSelect: first },
    })

    rerender({ onSelect: second })
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-preview', type: 'select', blockId: 'blk_late' },
    })))

    expect(second).toHaveBeenCalledWith('blk_late')
    expect(first).not.toHaveBeenCalled()
  })

  it('uses the LATEST onReady after a re-render', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      ({ onReady }) => usePreviewBridge({ onSelect: vi.fn(), onReady }),
      { initialProps: { onReady: first } },
    )

    rerender({ onReady: second })
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-preview', type: 'ready' },
    })))

    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  // Round 2, Task 3. The frame posts `edit-target` on double-click; the hook
  // only forwards it. Resolution to a field happens in the BUILDER, which is
  // the only side holding form state — see PageBuilderView's `onEditTarget`.
  it('forwards an edit-target message to onEditTarget', () => {
    const onEditTarget = vi.fn()
    renderHook(() => usePreviewBridge({ onSelect: vi.fn(), onEditTarget }))
    const msg = {
      source: 'nb-preview',
      type: 'edit-target',
      blockId: 'blk_3',
      part: 'heading',
      text: 'Fresh bread',
      rect: { top: 10, left: 20, width: 300, height: 40 },
    }
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: msg,
    })))
    expect(onEditTarget).toHaveBeenCalledWith(msg)
  })

  // Optional, like `onReady` — a caller that does not do in-place editing must
  // not crash on a double-click in the frame.
  it('ignores an edit-target message when no onEditTarget is supplied', () => {
    renderHook(() => usePreviewBridge({ onSelect: vi.fn() }))
    expect(() => {
      act(() => window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          source: 'nb-preview',
          type: 'edit-target',
          blockId: 'blk_3',
          part: 'heading',
          text: 'x',
          rect: { top: 0, left: 0, width: 1, height: 1 },
        },
      })))
    }).not.toThrow()
  })

  it('holds the rects reported by a rects message', () => {
    const { result } = renderHook(() => usePreviewBridge({ onSelect: vi.fn() }))
    const rects = [{ blockId: 'blk_1', top: 0, left: 0, width: 1280, height: 400 }]
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-preview', type: 'rects', rects },
    })))
    expect(result.current.rects).toEqual(rects)
  })

  it('holds the hovered block id reported by a hover message, and clears it on null', () => {
    const { result } = renderHook(() => usePreviewBridge({ onSelect: vi.fn() }))
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-preview', type: 'hover', blockId: 'blk_2' },
    })))
    expect(result.current.hoveredId).toBe('blk_2')

    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-preview', type: 'hover', blockId: null },
    })))
    expect(result.current.hoveredId).toBeNull()
  })

  it('measure() posts a measure message to the iframe contentWindow', () => {
    const { result } = renderHook(() => usePreviewBridge({ onSelect: vi.fn() }))
    const post = vi.fn()
    // @ts-expect-error minimal stub
    result.current.iframeRef.current = { contentWindow: { postMessage: post } }
    act(() => result.current.measure())
    expect(post).toHaveBeenCalledWith({ source: 'nb-builder', type: 'measure' }, window.location.origin)
  })

  it('calls measure() when a ready message arrives', () => {
    const { result } = renderHook(() => usePreviewBridge({ onSelect: vi.fn() }))
    const post = vi.fn()
    // @ts-expect-error minimal stub
    result.current.iframeRef.current = { contentWindow: { postMessage: post } }
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-preview', type: 'ready' },
    })))
    expect(post).toHaveBeenCalledWith({ source: 'nb-builder', type: 'measure' }, window.location.origin)
  })

  it('clears stale rects and re-measures when the device prop changes', () => {
    const post = vi.fn()
    const { result, rerender } = renderHook(
      ({ device }: { device: DeviceKey }) => usePreviewBridge({ onSelect: vi.fn(), device }),
      { initialProps: { device: 'desktop' } },
    )
    // @ts-expect-error minimal stub
    result.current.iframeRef.current = { contentWindow: { postMessage: post } }
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        source: 'nb-preview',
        type: 'rects',
        rects: [{ blockId: 'blk_1', top: 0, left: 0, width: 1280, height: 400 }],
      },
    })))
    expect(result.current.rects).toHaveLength(1)

    post.mockClear()
    rerender({ device: 'mobile' })

    // Stale rects (from the desktop layout) must not linger under the new
    // device's scale — see the hook's docblock on why.
    expect(result.current.rects).toEqual([])
    expect(post).toHaveBeenCalledWith({ source: 'nb-builder', type: 'measure' }, window.location.origin)
  })
})
