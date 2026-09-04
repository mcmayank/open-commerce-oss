import { beforeEach, describe, expect, it, vi } from 'vitest'
import { promoteBlockStyle } from './promoteBlockStyle'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function settingsDoc(defaults: unknown) {
  return { ok: true, json: async () => ({ docs: [{ id: 'ss_1', blockStyleDefaults: defaults }] }) }
}

describe('promoteBlockStyle', () => {
  it('merges the style under its blockType, preserving other block types', async () => {
    fetchMock.mockResolvedValueOnce(settingsDoc({ productGrid: { heading: { size: 'sm' } } }))
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    await promoteBlockStyle('hero', { heading: { size: 'xl' } })

    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/store-settings/ss_1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({
      blockStyleDefaults: { productGrid: { heading: { size: 'sm' } }, hero: { heading: { size: 'xl' } } },
    })
  })

  it('replaces that blockType rather than deep-merging into it', async () => {
    fetchMock.mockResolvedValueOnce(settingsDoc({ hero: { heading: { size: 'sm' }, eyebrow: { weight: '700' } } }))
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    await promoteBlockStyle('hero', { heading: { size: 'xl' } })

    expect(JSON.parse(fetchMock.mock.calls[1][1].body).blockStyleDefaults.hero).toEqual({ heading: { size: 'xl' } })
  })

  it('starts from an empty map when the store has no defaults yet', async () => {
    fetchMock.mockResolvedValueOnce(settingsDoc(null))
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await promoteBlockStyle('hero', { heading: { size: 'xl' } })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).blockStyleDefaults).toEqual({ hero: { heading: { size: 'xl' } } })
  })

  it('throws when the store has no settings document, rather than writing nothing and reporting success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [] }) })
    await expect(promoteBlockStyle('hero', {})).rejects.toThrow(/settings/i)
  })

  it('throws when the PATCH fails', async () => {
    fetchMock.mockResolvedValueOnce(settingsDoc({}))
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
    await expect(promoteBlockStyle('hero', {})).rejects.toThrow(/403/)
  })
})
