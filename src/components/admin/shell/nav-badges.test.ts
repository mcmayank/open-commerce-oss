import { describe, it, expect, vi } from 'vitest'
import { navBadges } from './nav-badges'

const payload = (count: number) => ({
  find: vi.fn().mockResolvedValue({ totalDocs: count }),
}) as any

describe('navBadges', () => {
  it('returns the unfulfilled orders count under the orders slug', async () => {
    const p = payload(7)
    const badges = await navBadges(p, 'tenant-1')
    expect(badges.orders).toBe(7)
    expect(p.find).toHaveBeenCalledOnce()
  })

  it('never throws — returns {} when the query fails', async () => {
    const p = { find: vi.fn().mockRejectedValue(new Error('db down')) } as any
    await expect(navBadges(p, 'tenant-1')).resolves.toEqual({})
  })

  it('returns {} for a null tenant', async () => {
    const p = { find: vi.fn() } as any
    expect(await navBadges(p, null)).toEqual({})
    expect(p.find).not.toHaveBeenCalled()
  })
})
