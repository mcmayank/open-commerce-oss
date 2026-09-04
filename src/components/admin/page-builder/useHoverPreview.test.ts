/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import * as React from 'react'
import { renderHook, render, act, cleanup } from '@testing-library/react'
import { useHoverPreview } from './useHoverPreview'
import { varsForStyle, type BlockStyle } from '@/lib/block-style/vocabulary'
import { PreviewBridge } from '@/app/(storefront)/store/[tenant]/components/PreviewBridge'

// jsdom doesn't implement ResizeObserver, and PreviewBridge's mount effect
// now constructs one unconditionally (final-review Important 3) — the "crosses
// the seam into the real PreviewBridge" describe below renders the real
// component, so it needs this the same way PreviewBridge.test.tsx's own
// FakeResizeObserver does. This suite doesn't assert on it, so a bare no-op
// stub is enough.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', NoopResizeObserver)

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useHoverPreview', () => {
  it('does not patch before the intent delay elapses', () => {
    const patch = vi.fn()
    const { result } = renderHook(() =>
      useHoverPreview({ patch, blockId: 'b1', style: {}, delayMs: 120 }),
    )
    act(() => result.current.onPreview('heading', 'size', '3xl'))
    expect(patch).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(120))
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch.mock.calls[0][0]).toBe('b1')
    expect(patch.mock.calls[0][1]['--bs-heading-size']).toBeTruthy()
  })

  it('scanning across options never commits the ones passed over', () => {
    const patch = vi.fn()
    const { result } = renderHook(() =>
      useHoverPreview({ patch, blockId: 'b1', style: {}, delayMs: 120 }),
    )
    act(() => result.current.onPreview('heading', 'size', 'sm'))
    act(() => void vi.advanceTimersByTime(50))
    act(() => result.current.onPreview('heading', 'size', 'lg'))
    act(() => void vi.advanceTimersByTime(50))
    act(() => result.current.onPreview('heading', 'size', '3xl'))
    act(() => void vi.advanceTimersByTime(120))
    expect(patch).toHaveBeenCalledTimes(1)
  })

  it('reverts on leave, sending the full committed style — which omits a var the preview introduced', () => {
    // `patch()` is PreviewBridge's replace-semantics protocol (see the hook's
    // docblock): it always carries the FULL var set, so a reverted control is
    // simply ABSENT from the patch rather than present with an empty-string
    // value. The committed style here is `{}`, so the reverting patch has no
    // keys at all.
    const patch = vi.fn()
    const { result } = renderHook(() =>
      useHoverPreview({ patch, blockId: 'b1', style: {}, delayMs: 120 }),
    )
    act(() => result.current.onPreview('heading', 'size', '3xl'))
    act(() => void vi.advanceTimersByTime(120))
    patch.mockClear()
    act(() => result.current.onPreviewEnd())
    expect(patch).toHaveBeenCalledTimes(1)
    const vars = patch.mock.calls[0][1]
    expect(vars).toBeTruthy()
    expect('--bs-heading-size' in vars).toBe(false)
  })

  it('does nothing on leave when no preview was ever applied', () => {
    const patch = vi.fn()
    const { result } = renderHook(() =>
      useHoverPreview({ patch, blockId: 'b1', style: {}, delayMs: 120 }),
    )
    act(() => result.current.onPreview('heading', 'size', '3xl'))
    act(() => result.current.onPreviewEnd())
    act(() => void vi.advanceTimersByTime(500))
    expect(patch).not.toHaveBeenCalled()
  })

  it('reverts to the committed style, not to empty, when the control already had a value', () => {
    const patch = vi.fn()
    const { result } = renderHook(() =>
      useHoverPreview({
        patch,
        blockId: 'b1',
        style: { heading: { size: 'lg' } },
        delayMs: 120,
      }),
    )
    act(() => result.current.onPreview('heading', 'size', '3xl'))
    act(() => void vi.advanceTimersByTime(120))
    patch.mockClear()
    act(() => result.current.onPreviewEnd())
    expect(patch.mock.calls[0][1]['--bs-heading-size']).not.toBe('')
  })
})

// Coverage added post-review: the blockId-change safety net (BlockInspector
// keeps this hook mounted across a selection change, so the unmount-only
// cleanup above never runs for that case — see useHoverPreview.ts). These
// tests pin the behaviour that reverts against the OLD block/style rather
// than the new one, and that a still-pending timer can't fire against either
// block after the selection moves on.
describe('useHoverPreview — selection changes mid-preview', () => {
  it('reverts against the OLD block, not the new one, when the selection changes after a preview settled', () => {
    const patch = vi.fn()
    const { result, rerender } = renderHook(
      (props: { blockId: string; style: BlockStyle }) =>
        useHoverPreview({ patch, blockId: props.blockId, style: props.style, delayMs: 120 }),
      { initialProps: { blockId: 'b1', style: {} as BlockStyle } },
    )
    act(() => result.current.onPreview('heading', 'size', '3xl'))
    act(() => void vi.advanceTimersByTime(120))
    patch.mockClear()

    act(() => rerender({ blockId: 'b2', style: {} }))

    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch.mock.calls[0]).toBeTruthy()
    expect(patch.mock.calls[0][0]).toBe('b1')
    expect(patch.mock.calls[0][0]).not.toBe('b2')
    // Full var set (see docblock), not a diff: b1's committed style was `{}`,
    // so the reverting patch carries no `--bs-heading-size` key at all.
    const vars = patch.mock.calls[0][1]
    expect(vars).toBeTruthy()
    expect('--bs-heading-size' in vars).toBe(false)
  })

  it('reverts using the OLD block\'s committed style, not the new block\'s, when both change together', () => {
    const patch = vi.fn()
    const { result, rerender } = renderHook(
      (props: { blockId: string; style: BlockStyle }) =>
        useHoverPreview({ patch, blockId: props.blockId, style: props.style, delayMs: 120 }),
      { initialProps: { blockId: 'b1', style: { heading: { size: 'lg' } } } as { blockId: string; style: BlockStyle } },
    )
    act(() => result.current.onPreview('heading', 'size', '3xl'))
    act(() => void vi.advanceTimersByTime(120))
    patch.mockClear()

    act(() => rerender({ blockId: 'b2', style: { heading: { size: 'sm' } } }))

    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch.mock.calls[0]).toBeTruthy()
    expect(patch.mock.calls[0][0]).toBe('b1')
    const revertedValue = patch.mock.calls[0][1]['--bs-heading-size']
    expect(revertedValue).toBeTruthy()
    expect(revertedValue).toBe(varsForStyle({ heading: { size: 'lg' } })['--bs-heading-size'])
    expect(revertedValue).not.toBe(varsForStyle({ heading: { size: 'sm' } })['--bs-heading-size'])
  })

  it('does not fire a pending preview against either block when the selection changes before the delay elapses', () => {
    const patch = vi.fn()
    const { result, rerender } = renderHook(
      (props: { blockId: string; style: BlockStyle }) =>
        useHoverPreview({ patch, blockId: props.blockId, style: props.style, delayMs: 120 }),
      { initialProps: { blockId: 'b1', style: {} as BlockStyle } },
    )
    act(() => result.current.onPreview('heading', 'size', '3xl'))
    act(() => void vi.advanceTimersByTime(50))

    act(() => rerender({ blockId: 'b2', style: {} }))
    act(() => void vi.advanceTimersByTime(120))

    expect(patch).not.toHaveBeenCalled()
  })
})

// Regression coverage for CRITICAL-1 (final whole-branch review): no test on
// either side of the hook/bridge boundary exercised the two together, so a
// hook that sent a partial patch into a full-replace protocol shipped
// unnoticed. This feeds `useHoverPreview`'s real emitted patch through the
// REAL `PreviewBridge` message handler (not a mock of it) for a block that
// already has two vars applied, then hovers a third control.
describe('useHoverPreview — crosses the seam into the real PreviewBridge', () => {
  it('leaves two already-applied vars intact on the wrapper when a hover previews a third', () => {
    render(React.createElement(PreviewBridge))
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-nb-block-id', 'blk_seam')
    document.body.appendChild(wrapper)

    const patchViaBridge = (blockId: string, vars: Record<string, string>) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { source: 'nb-builder', type: 'patch', blockId, vars },
        }),
      )
    }

    // Two controls already committed and applied to the wrapper, the way
    // `BlockInspector.handleChange` applies a committed style change: a full
    // var set for the block's whole style.
    const committed: BlockStyle = { heading: { size: 'lg' }, media: { radius: 'sm' } }
    patchViaBridge('blk_seam', varsForStyle(committed))
    expect(wrapper.style.getPropertyValue('--bs-heading-size')).toBe(
      varsForStyle(committed)['--bs-heading-size'],
    )
    expect(wrapper.style.getPropertyValue('--bs-media-radius')).toBe(
      varsForStyle(committed)['--bs-media-radius'],
    )

    // Hover a THIRD control (never touched above) and let the intent delay
    // elapse.
    const { result } = renderHook(() =>
      useHoverPreview({ patch: patchViaBridge, blockId: 'blk_seam', style: committed, delayMs: 120 }),
    )
    act(() => result.current.onPreview('accent', 'italic', 'on'))
    act(() => void vi.advanceTimersByTime(120))

    // The two pre-existing vars must survive — PreviewBridge is a
    // full-replace protocol, so a hook sending only the changed key would
    // make the bridge remove both of these.
    expect(wrapper.style.getPropertyValue('--bs-heading-size')).toBe(
      varsForStyle(committed)['--bs-heading-size'],
    )
    expect(wrapper.style.getPropertyValue('--bs-media-radius')).toBe(
      varsForStyle(committed)['--bs-media-radius'],
    )
    // ...and the previewed third var did apply.
    expect(wrapper.style.getPropertyValue('--bs-accent-style')).toBe('italic')
  })
})
