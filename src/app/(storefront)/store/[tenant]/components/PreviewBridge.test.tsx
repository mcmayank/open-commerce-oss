/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { PreviewBridge } from './PreviewBridge'

// jsdom doesn't implement ResizeObserver at all — real browsers do, and
// production code (mount effect below) now creates one unconditionally, so
// every test in this file needs SOME global to construct without throwing.
// This fake is also controllable: tests that care observe `instances` and
// invoke a captured callback directly to simulate a resize firing.
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  callback: ResizeObserverCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    FakeResizeObserver.instances.push(this)
  }
}
vi.stubGlobal('ResizeObserver', FakeResizeObserver)

afterEach(() => {
  cleanup()
  // `vi.spyOn(window.parent, 'postMessage')` re-wraps the same spy across
  // tests without restoring, so an earlier test's call history would
  // otherwise leak into a later `expect(post).not.toHaveBeenCalled()`.
  vi.restoreAllMocks()
  // Some geometry tests below fake `requestAnimationFrame`/`cancelAnimationFrame`
  // to make the rAF coalescing deterministic. If an assertion inside one of
  // those tests throws before it calls `vi.useRealTimers()` itself, this is the
  // backstop that keeps fake timers from leaking into every later test.
  vi.useRealTimers()
  FakeResizeObserver.instances = []
})

describe('PreviewBridge', () => {
  it('posts a select message with the clicked block id', () => {
    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_42')
    document.body.appendChild(block)
    fireEvent.click(block)
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'nb-preview', type: 'select', blockId: 'blk_42' }),
      window.location.origin,
    )
  })

  it('applies a patch to the target block wrapper style', () => {
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_9')
    document.body.appendChild(block)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-builder', type: 'patch', blockId: 'blk_9', vars: { '--bs-section-pad': '5rem' } },
    }))
    expect(block.style.getPropertyValue('--bs-section-pad')).toBe('5rem')
  })

  it('only applies --bs-* keys from a patch, ignoring anything else in vars', () => {
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_10')
    document.body.appendChild(block)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        source: 'nb-builder',
        type: 'patch',
        blockId: 'blk_10',
        vars: { '--bs-section-pad': '4rem', color: 'red' },
      },
    }))
    expect(block.style.getPropertyValue('--bs-section-pad')).toBe('4rem')
    expect(block.style.getPropertyValue('color')).toBe('')
  })

  it('removes a previously-applied var that is absent from a later patch', () => {
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_11')
    document.body.appendChild(block)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        source: 'nb-builder',
        type: 'patch',
        blockId: 'blk_11',
        vars: { '--bs-heading-size': '3rem' },
      },
    }))
    expect(block.style.getPropertyValue('--bs-heading-size')).toBe('3rem')

    // A control reset to Default omits its var from the next patch — the
    // bridge must clear the stale value rather than leaving it applied.
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        source: 'nb-builder',
        type: 'patch',
        blockId: 'blk_11',
        vars: { '--bs-section-pad': '4rem' },
      },
    }))
    expect(block.style.getPropertyValue('--bs-heading-size')).toBe('')
    expect(block.style.getPropertyValue('--bs-section-pad')).toBe('4rem')
  })

  it('does not post a select message when the clicked block id is empty', () => {
    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', '')
    document.body.appendChild(block)
    fireEvent.click(block)
    expect(post).not.toHaveBeenCalled()
  })

  it('applies data-scheme and section vars for a scheme message', () => {
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_20')
    document.body.appendChild(block)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-builder', type: 'scheme', blockId: 'blk_20', scheme: 'muted' },
    }))
    expect(block.getAttribute('data-scheme')).toBe('muted')
    expect(block.style.getPropertyValue('--section-bg')).not.toBe('')
  })

  it('clears data-scheme and previously-applied section vars on a theme-default scheme message', () => {
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_21')
    document.body.appendChild(block)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-builder', type: 'scheme', blockId: 'blk_21', scheme: 'muted' },
    }))
    expect(block.getAttribute('data-scheme')).toBe('muted')
    expect(block.style.getPropertyValue('--section-bg')).not.toBe('')

    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'nb-builder', type: 'scheme', blockId: 'blk_21', scheme: '' },
    }))
    expect(block.getAttribute('data-scheme')).toBeNull()
    expect(block.style.getPropertyValue('--section-bg')).toBe('')
  })

  it('posts an edit-target on double-click of a marked text node', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-nb-block-id', 'blk_1')
    const h = document.createElement('h1')
    h.setAttribute('data-nb-part', 'heading')
    h.textContent = 'Fresh bread'
    wrapper.appendChild(h)
    document.body.appendChild(wrapper)

    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    h.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

    const posted = post.mock.calls.map(([m]) => m as { type?: string }).filter((m) => m.type === 'edit-target')
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ source: 'nb-preview', blockId: 'blk_1', part: 'heading', text: 'Fresh bread' })
  })

  it('posts nothing when the double-click misses a marked part', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-nb-block-id', 'blk_1')
    const plain = document.createElement('div')
    wrapper.appendChild(plain)
    document.body.appendChild(wrapper)

    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    plain.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

    expect(post.mock.calls.map(([m]) => m as { type?: string }).filter((m) => m.type === 'edit-target')).toHaveLength(0)
  })
})

describe('PreviewBridge — clicks select without activating the storefront', () => {
  it('suppresses navigation when a link inside a block is clicked', () => {
    // Selecting a block by clicking it is the builder's primary gesture, and
    // blocks are full of links (hero CTAs, product cards). Without this the
    // preview navigates away from the page being edited.
    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_cta')
    const link = document.createElement('a')
    link.href = '/products'
    block.appendChild(link)
    document.body.appendChild(block)

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'nb-preview', type: 'select', blockId: 'blk_cta' }),
      window.location.origin,
    )
  })

  it('suppresses submission when a button inside a block is clicked', () => {
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_form')
    const button = document.createElement('button')
    block.appendChild(button)
    document.body.appendChild(block)

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    button.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves clicks outside any block alone', () => {
    // Chrome the storefront renders around the blocks (skip links, the cart
    // drawer) is not the builder's to intercept.
    render(<PreviewBridge />)
    const outside = document.createElement('a')
    outside.href = '/cart'
    document.body.appendChild(outside)

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    outside.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })
})

// A message posted by the bridge is untyped from the spy's point of view —
// this narrows just enough to read the fields these tests assert on without
// scattering `as any` through them.
type PostedMessage = {
  type?: string
  blockId?: string | null
  rects?: Array<{ blockId: string; top: number; left: number; width: number; height: number }>
}

function findPosted(post: { mock: { calls: unknown[][] } }, type: string) {
  const call = post.mock.calls.find((c) => (c[0] as PostedMessage)?.type === type)
  return call?.[0] as PostedMessage | undefined
}

describe('PreviewBridge — block geometry reporting', () => {
  afterEach(() => {
    // These two tests override scrollX/scrollY on the shared jsdom `window`
    // (a per-file singleton in this test file) to make the offset math
    // observable — reset them so a later test never inherits a nonzero
    // scroll position it didn't ask for.
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })

  it('reports the raw viewport-relative rect, unaffected by scroll offset', () => {
    // The builder's overlay is anchored to the IFRAME's fixed on-screen box
    // in the parent page, so it needs each block's CURRENT on-screen
    // (viewport-relative) position — not a scroll-invariant document-absolute
    // one. A nonzero scroll offset here that still yields the raw 10/20 (not
    // 210/120) is what proves the `+ scrollX`/`+ scrollY` terms are gone —
    // a zero-scroll test would pass identically either way.
    Object.defineProperty(window, 'scrollX', { value: 100, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true })
    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_scroll')
    document.body.appendChild(block)
    block.getBoundingClientRect = () =>
      ({
        top: 10,
        left: 20,
        width: 300,
        height: 150,
        right: 320,
        bottom: 160,
        x: 20,
        y: 10,
        toJSON: () => ({}),
      }) as DOMRect

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { source: 'nb-builder', type: 'measure' },
      }),
    )

    const posted = findPosted(post, 'rects')
    expect(posted).toBeDefined()
    const rect = posted?.rects?.find((r) => r.blockId === 'blk_scroll')
    expect(rect).toBeDefined()
    expect(rect?.top).toBe(10)
    expect(rect?.left).toBe(20)
    expect(rect?.width).toBe(300)
    expect(rect?.height).toBe(150)
  })

  it('re-measures on scroll so a block that moved on screen reports its new position', () => {
    // Proves the overlay actually tracks scroll: the block's on-screen
    // position changes (exactly what happens when the merchant scrolls the
    // storefront content inside the iframe), a bare `scroll` event fires with
    // no explicit `measure` request from the builder, and the NEXT rects post
    // reflects the new position rather than the one measured at mount.
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_moved')
    document.body.appendChild(block)
    let top = 400
    block.getBoundingClientRect = () =>
      ({
        top,
        left: 0,
        width: 300,
        height: 150,
        right: 300,
        bottom: top + 150,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { source: 'nb-builder', type: 'measure' },
      }),
    )
    expect(findPosted(post, 'rects')?.rects?.find((r) => r.blockId === 'blk_moved')?.top).toBe(400)

    top = 100
    post.mockClear()
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(20)

    const rect = findPosted(post, 'rects')?.rects?.find((r) => r.blockId === 'blk_moved')
    expect(rect).toBeDefined()
    expect(rect?.top).toBe(100)
  })

  it('posts the hovered block id on mouseover, and null once the pointer leaves every block', () => {
    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_hover')
    const child = document.createElement('span')
    block.appendChild(child)
    document.body.appendChild(block)
    const outside = document.createElement('div')
    document.body.appendChild(outside)

    // Hovering a descendant of the block wrapper (not the wrapper itself)
    // must still resolve to the wrapper's id via `closest`.
    fireEvent.mouseOver(child)
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'nb-preview', type: 'hover', blockId: 'blk_hover' }),
      window.location.origin,
    )

    fireEvent.mouseOver(outside)
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'nb-preview', type: 'hover', blockId: null }),
      window.location.origin,
    )
  })

  it('coalesces rapid scroll/resize events into one rects post per animation frame, and recovers on the next burst', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_raf')
    document.body.appendChild(block)

    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))

    // Presence guard: a frame really was scheduled, and only once — if the
    // `if (raf) return` guard were missing, each of the three events above
    // would schedule its own frame.
    expect(rafSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(20)
    expect(post.mock.calls.filter((c) => (c[0] as PostedMessage)?.type === 'rects')).toHaveLength(1)

    // Not stuck: if the callback failed to reset `raf` back to 0 after
    // firing, this second burst would find `raf` still truthy and never
    // schedule again, and the count below would stay at 1.
    window.dispatchEvent(new Event('scroll'))
    expect(rafSpy).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(20)
    expect(post.mock.calls.filter((c) => (c[0] as PostedMessage)?.type === 'rects')).toHaveLength(2)
  })

  it('cancels a pending measurement frame on unmount so no late rects post fires', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame')
    const post = vi.spyOn(window.parent, 'postMessage')
    const { unmount } = render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_unmount')
    document.body.appendChild(block)

    window.dispatchEvent(new Event('scroll'))
    // Presence guard: there is genuinely a pending frame to cancel — without
    // this, "no late post" would pass vacuously because there was never
    // anything scheduled to fire late in the first place.
    expect(rafSpy).toHaveBeenCalledTimes(1)

    unmount()
    expect(cancelSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(50)
    expect(post.mock.calls.filter((c) => (c[0] as PostedMessage)?.type === 'rects')).toHaveLength(0)
  })

  // Final-review Important 3: neither image load nor a `--bs-*`-driven resize
  // fires `scroll`/`resize` on `window`, so before this fix nothing re-measured
  // for either. A `ResizeObserver` on `document.documentElement` and a
  // `window.load` listener close both gaps.
  it('observes document.documentElement for size changes, funnelled through the same rAF coalescing', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_resize')
    document.body.appendChild(block)

    const observer = FakeResizeObserver.instances[0]
    // Presence guard: an observer really was created and told to watch the
    // document root — without this, "a resize re-measures" would pass
    // vacuously if the observer were never wired up at all.
    expect(observer).toBeDefined()
    expect(observer.observe).toHaveBeenCalledWith(document.documentElement)

    post.mockClear()
    observer.callback([], observer as unknown as ResizeObserver)
    vi.advanceTimersByTime(20)

    expect(post.mock.calls.filter((c) => (c[0] as PostedMessage)?.type === 'rects')).toHaveLength(1)
  })

  it('disconnects the ResizeObserver on unmount', () => {
    const { unmount } = render(<PreviewBridge />)
    const observer = FakeResizeObserver.instances[0]
    expect(observer).toBeDefined()
    unmount()
    expect(observer.disconnect).toHaveBeenCalledTimes(1)
  })

  it('re-measures on window load, catching layout that only settles once images finish', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_load')
    document.body.appendChild(block)

    post.mockClear()
    window.dispatchEvent(new Event('load'))
    vi.advanceTimersByTime(20)

    expect(post.mock.calls.filter((c) => (c[0] as PostedMessage)?.type === 'rects')).toHaveLength(1)
  })
})

describe('PreviewBridge — hover clears when the pointer leaves the frame (final-review Important 4)', () => {
  it('posts hover:null when the pointer leaves the document, with no further mouseover needed', () => {
    // Before this fix, `hover: null` was only ever posted by `handleHover`
    // firing on a non-block element INSIDE the frame — moving the pointer
    // from a block straight out to a rail fires no further `mouseover` here
    // at all, so the last hovered id (and its dashed outline) stuck forever.
    const post = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewBridge />)
    const block = document.createElement('div')
    block.setAttribute('data-nb-block-id', 'blk_leave')
    document.body.appendChild(block)

    fireEvent.mouseOver(block)
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'nb-preview', type: 'hover', blockId: 'blk_leave' }),
      window.location.origin,
    )

    post.mockClear()
    fireEvent(document, new MouseEvent('mouseleave', { bubbles: false }))

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'nb-preview', type: 'hover', blockId: null }),
      window.location.origin,
    )
  })

  it('removes the mouseleave listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = render(<PreviewBridge />)
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function))
  })
})
