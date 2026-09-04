import { describe, it, expect } from 'vitest'
import { parseBridgeMessage } from './protocol'

describe('parseBridgeMessage', () => {
  const ORIGIN = 'https://store-a.lvh.me:3000'
  it('parses a valid select message from the same origin', () => {
    const m = parseBridgeMessage({ source: 'nb-preview', type: 'select', blockId: 'blk_1' }, ORIGIN, ORIGIN)
    expect(m).toEqual({ source: 'nb-preview', type: 'select', blockId: 'blk_1' })
  })
  it('rejects a cross-origin message', () => {
    expect(parseBridgeMessage({ source: 'nb-preview', type: 'ready' }, 'https://evil.com', ORIGIN)).toBeNull()
  })
  it('rejects a message without the nb source tag', () => {
    expect(parseBridgeMessage({ type: 'select', blockId: 'x' }, ORIGIN, ORIGIN)).toBeNull()
  })
  it('rejects a patch with a non-string-map vars', () => {
    expect(parseBridgeMessage({ source: 'nb-builder', type: 'patch', blockId: 'x', vars: 'nope' }, ORIGIN, ORIGIN)).toBeNull()
  })
  it('parses a valid patch message', () => {
    const m = parseBridgeMessage({ source: 'nb-builder', type: 'patch', blockId: 'x', vars: { '--bs-section-pad': '4rem' } }, ORIGIN, ORIGIN)
    expect(m).toMatchObject({ type: 'patch', blockId: 'x', vars: { '--bs-section-pad': '4rem' } })
  })
  it('parses a valid scheme message', () => {
    const m = parseBridgeMessage({ source: 'nb-builder', type: 'scheme', blockId: 'x', scheme: 'muted' }, ORIGIN, ORIGIN)
    expect(m).toEqual({ source: 'nb-builder', type: 'scheme', blockId: 'x', scheme: 'muted' })
  })
  it('parses a scheme message with an empty-string scheme (theme default)', () => {
    const m = parseBridgeMessage({ source: 'nb-builder', type: 'scheme', blockId: 'x', scheme: '' }, ORIGIN, ORIGIN)
    expect(m).toEqual({ source: 'nb-builder', type: 'scheme', blockId: 'x', scheme: '' })
  })
  it('rejects a scheme message with a non-string scheme', () => {
    expect(parseBridgeMessage({ source: 'nb-builder', type: 'scheme', blockId: 'x', scheme: 3 }, ORIGIN, ORIGIN)).toBeNull()
  })
  it('rejects a scheme message with a missing blockId', () => {
    expect(parseBridgeMessage({ source: 'nb-builder', type: 'scheme', scheme: 'muted' }, ORIGIN, ORIGIN)).toBeNull()
  })
})

describe('rects / hover / measure', () => {
  const ORIGIN = 'https://shop.example.com'

  it('accepts a well-formed rects message', () => {
    const msg = parseBridgeMessage(
      {
        source: 'nb-preview',
        type: 'rects',
        rects: [{ blockId: 'a1', top: 0, left: 0, width: 1280, height: 540 }],
      },
      ORIGIN,
      ORIGIN,
    )
    expect(msg).toEqual({
      source: 'nb-preview',
      type: 'rects',
      rects: [{ blockId: 'a1', top: 0, left: 0, width: 1280, height: 540 }],
    })
  })

  it('rejects a rects message whose numbers are not finite', () => {
    expect(
      parseBridgeMessage(
        {
          source: 'nb-preview',
          type: 'rects',
          rects: [{ blockId: 'a1', top: Number.NaN, left: 0, width: 10, height: 10 }],
        },
        ORIGIN,
        ORIGIN,
      ),
    ).toBeNull()
  })

  it('rejects a rects message whose payload is not an array', () => {
    expect(
      parseBridgeMessage({ source: 'nb-preview', type: 'rects', rects: {} }, ORIGIN, ORIGIN),
    ).toBeNull()
  })

  it('accepts hover with an id and with null', () => {
    expect(
      parseBridgeMessage({ source: 'nb-preview', type: 'hover', blockId: 'b2' }, ORIGIN, ORIGIN),
    ).toEqual({ source: 'nb-preview', type: 'hover', blockId: 'b2' })
    expect(
      parseBridgeMessage({ source: 'nb-preview', type: 'hover', blockId: null }, ORIGIN, ORIGIN),
    ).toEqual({ source: 'nb-preview', type: 'hover', blockId: null })
  })

  it('rejects hover with a non-string, non-null id', () => {
    expect(
      parseBridgeMessage({ source: 'nb-preview', type: 'hover', blockId: 7 }, ORIGIN, ORIGIN),
    ).toBeNull()
  })

  it('accepts a measure request from the builder', () => {
    expect(parseBridgeMessage({ source: 'nb-builder', type: 'measure' }, ORIGIN, ORIGIN)).toEqual({
      source: 'nb-builder',
      type: 'measure',
    })
  })

  it('still rejects every new type from a foreign origin', () => {
    expect(
      parseBridgeMessage(
        { source: 'nb-preview', type: 'rects', rects: [] },
        'https://evil.example.com',
        ORIGIN,
      ),
    ).toBeNull()
  })

  it('parses an edit-target message', () => {
    const msg = {
      source: 'nb-preview',
      type: 'edit-target',
      blockId: 'blk_1',
      part: 'heading',
      text: 'Fresh bread',
      rect: { top: 10, left: 20, width: 300, height: 40 },
    }
    expect(parseBridgeMessage(msg, 'https://x', 'https://x')).toEqual(msg)
  })

  it('rejects an edit-target whose rect is not finite numbers', () => {
    const msg = {
      source: 'nb-preview',
      type: 'edit-target',
      blockId: 'blk_1',
      part: 'heading',
      text: 'Fresh bread',
      rect: { top: 10, left: 20, width: Number.NaN, height: 40 },
    }
    expect(parseBridgeMessage(msg, 'https://x', 'https://x')).toBeNull()
  })

  it('rejects an edit-target with a non-string part or text', () => {
    const base = { source: 'nb-preview', type: 'edit-target', blockId: 'b', rect: { top: 0, left: 0, width: 1, height: 1 } }
    expect(parseBridgeMessage({ ...base, part: 1, text: 'x' }, 'https://x', 'https://x')).toBeNull()
    expect(parseBridgeMessage({ ...base, part: 'heading', text: 1 }, 'https://x', 'https://x')).toBeNull()
  })
})
