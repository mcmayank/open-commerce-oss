import { describe, expect, it, vi } from 'vitest'
import { assertCustomSections, assertCustomSectionDefinition } from './plan-enforcement'
// Plan-backed entitlements so the refusal paths below are exercised in both the
// private repo and the OSS export (whose real overlay grants everything).
vi.mock('@/entitlements-overlay', () => import('@/test-utils/fake-entitlements'))


const payloadFor = (plan: string) =>
  ({ findByID: async () => ({ plan }) }) as unknown as Parameters<typeof assertCustomSections>[0]

const cs = (id: string) => ({ id, blockType: 'customSection' })

describe('assertCustomSections', () => {
  it('blocks a newly added custom section on the free plan', async () => {
    await expect(assertCustomSections(payloadFor('free'), 1, [cs('a')], null)).rejects.toThrow(/Growth/)
  })

  it('allows an existing custom section to be re-saved on the free plan', async () => {
    await expect(assertCustomSections(payloadFor('free'), 1, [cs('a')], [cs('a')])).resolves.toBeUndefined()
  })

  it('allows removing a custom section on the free plan', async () => {
    await expect(assertCustomSections(payloadFor('free'), 1, [], [cs('a')])).resolves.toBeUndefined()
  })

  it('allows a newly added custom section on growth', async () => {
    await expect(assertCustomSections(payloadFor('growth'), 1, [cs('a')], null)).resolves.toBeUndefined()
  })

  it('does not query the plan when nothing new was added', async () => {
    let queried = false
    const payload = {
      findByID: async () => {
        queried = true
        return { plan: 'free' }
      },
    } as unknown as Parameters<typeof assertCustomSections>[0]
    await assertCustomSections(payload, 1, [{ id: 'x', blockType: 'hero' }], null)
    expect(queried).toBe(false)
  })
})

describe('assertCustomSectionDefinition', () => {
  it('blocks creating a definition on the free plan', async () => {
    await expect(assertCustomSectionDefinition(payloadFor('free'), 1)).rejects.toThrow(/Growth/)
  })

  it('allows creating a definition on growth', async () => {
    await expect(assertCustomSectionDefinition(payloadFor('growth'), 1)).resolves.toBeUndefined()
  })
})
