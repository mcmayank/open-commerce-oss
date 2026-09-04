import { describe, expect, it } from 'vitest'
import { normalizeEmbedUrl } from './video-embed'

describe('normalizeEmbedUrl', () => {
  it('converts a youtube watch url', () => {
    expect(normalizeEmbedUrl('youtube', 'https://www.youtube.com/watch?v=abc123')).toBe('https://www.youtube.com/embed/abc123')
  })
  it('converts a youtu.be short url', () => {
    expect(normalizeEmbedUrl('youtube', 'https://youtu.be/abc123')).toBe('https://www.youtube.com/embed/abc123')
  })
  it('passes through an already-embed youtube url', () => {
    expect(normalizeEmbedUrl('youtube', 'https://www.youtube.com/embed/abc123')).toBe('https://www.youtube.com/embed/abc123')
  })
  it('converts a vimeo url', () => {
    expect(normalizeEmbedUrl('vimeo', 'https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871')
  })
  it('returns null for provider file (handled via upload, not url)', () => {
    expect(normalizeEmbedUrl('file', 'anything')).toBeNull()
  })
  it('returns null for an unparseable url', () => {
    expect(normalizeEmbedUrl('youtube', 'not a url')).toBeNull()
  })
  it('returns null for empty input', () => {
    expect(normalizeEmbedUrl('youtube', '')).toBeNull()
  })
})
