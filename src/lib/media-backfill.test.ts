import { describe, expect, it } from 'vitest'
import {
  hasVariants,
  planMediaBackfill,
  REPROCESSABLE_MIME_TYPES,
  summariseSkips,
  type BackfillDocLike,
} from './media-backfill'

/**
 * This decides what gets rewritten in a bucket, so the exclusions matter more
 * than the inclusions. Production really does hold an SVG logo and a webm that
 * the mime allowlist would refuse on the way back in — reprocessing either would
 * throw partway through a long run.
 */

const raw = (over: Partial<BackfillDocLike> = {}): BackfillDocLike => ({
  id: 1,
  filename: 'croissant.png',
  mimeType: 'image/png',
  filesize: 2_150_000,
  ...over,
})

const processed = raw({
  id: 2,
  filename: 'danish.webp',
  mimeType: 'image/webp',
  sizes: { thumb: { filename: 'danish-400x533.webp' } },
})

describe('planMediaBackfill', () => {
  it('reprocesses a raw original', () => {
    const plan = planMediaBackfill([raw()])
    expect(plan.process.map((d) => d.id)).toEqual([1])
    expect(plan.skip).toEqual([])
  })

  it('skips docs that already have variants, so a partial run is re-runnable', () => {
    // Each doc costs four bucket writes; a long run will be interrupted.
    const plan = planMediaBackfill([processed])
    expect(plan.process).toEqual([])
    expect(plan.skip[0].reason).toBe('already-processed')
  })

  it('skips types the mime allowlist would refuse on re-upload', () => {
    // Both exist in production today, uploaded before the allowlist.
    const plan = planMediaBackfill([
      raw({ id: 3, filename: 'logo.svg', mimeType: 'image/svg+xml' }),
      raw({ id: 4, filename: 'clip.webm', mimeType: 'video/webm' }),
      raw({ id: 5, filename: 'invoice.pdf', mimeType: 'application/pdf' }),
    ])
    expect(plan.process).toEqual([])
    expect(plan.skip.map((s) => s.reason)).toEqual([
      'not-an-accepted-image',
      'not-an-accepted-image',
      'not-an-accepted-image',
    ])
  })

  it('skips a doc with no filename rather than guessing at one', () => {
    const plan = planMediaBackfill([raw({ id: 6, filename: null })])
    expect(plan.process).toEqual([])
    expect(plan.skip[0].reason).toBe('no-filename')
  })

  it('accounts for every input doc exactly once', () => {
    // A doc falling through silently would be neither reprocessed nor reported,
    // and its storefront would keep serving a full-size original unnoticed.
    const docs = [raw(), processed, raw({ id: 7, mimeType: 'image/svg+xml' }), raw({ id: 8, filename: '' })]
    const plan = planMediaBackfill(docs)
    expect(plan.process.length + plan.skip.length).toBe(docs.length)
  })

  it('accepts exactly the types the collection accepts', () => {
    // Kept in step with Media.upload.mimeTypes by hand; this documents the set.
    expect([...REPROCESSABLE_MIME_TYPES].sort()).toEqual([
      'image/avif',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ])
  })
})

describe('hasVariants', () => {
  it('is false for a pre-processing doc', () => {
    expect(hasVariants(raw())).toBe(false)
    expect(hasVariants(raw({ sizes: {} }))).toBe(false)
    expect(hasVariants(raw({ sizes: null }))).toBe(false)
  })

  it('is false when the size keys exist but carry no file', () => {
    // Payload writes the columns whether or not a variant was produced.
    expect(hasVariants(raw({ sizes: { thumb: { filename: null }, card: null } }))).toBe(false)
  })

  it('is true once any variant has a file', () => {
    expect(hasVariants(processed)).toBe(true)
  })
})

describe('summariseSkips', () => {
  it('counts every reason, including the ones at zero', () => {
    const plan = planMediaBackfill([processed, raw({ id: 9, mimeType: 'video/webm' })])
    expect(summariseSkips(plan)).toEqual({
      'already-processed': 1,
      'not-an-accepted-image': 1,
      'no-filename': 0,
    })
  })
})
