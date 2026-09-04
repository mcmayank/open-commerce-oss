import { describe, expect, it, vi, beforeEach } from 'vitest'

const revalidateTag = vi.fn()
// Forward ALL args so the test pins the cache profile, not merely the tag.
vi.mock('next/cache', () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }))

import { SectionDefinitions } from './SectionDefinitions'
// These cases assert the multi-store query shapes, so pin the store-scope seam
// to its hosted branch; the OSS export replaces the overlay with the single-store one.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: true }))
// Plan-backed entitlements so the refusal paths below are exercised in both the
// private repo and the OSS export (whose real overlay grants everything).
vi.mock('@/entitlements-overlay', () => import('@/test-utils/fake-entitlements'))


type ValidateFn = (value: unknown) => true | string

function recipeValidate(): ValidateFn {
  const field = (SectionDefinitions.fields as { name?: string; validate?: ValidateFn }[]).find(
    (f) => f.name === 'recipe',
  )
  if (!field?.validate) throw new Error('recipe field has no validate')
  return field.validate
}

const validRecipe = {
  version: 1,
  container: { width: 'wide', padding: 'normal', scheme: 'muted', align: 'center' },
  header: { heading: { name: 'title', label: 'Title' } },
}

type BeforeChangeArgs = {
  req: { user?: unknown; payload: unknown }
  data: Record<string, unknown>
  operation: string
  originalDoc?: Record<string, unknown>
}
type BeforeChangeHook = (args: BeforeChangeArgs) => Promise<unknown>

type BeforeDeleteArgs = { req: { payload: unknown }; id: string | number }
type BeforeDeleteHook = (args: BeforeDeleteArgs) => Promise<unknown>

function beforeChangeHook(): BeforeChangeHook {
  const hook = SectionDefinitions.hooks?.beforeChange?.[0]
  if (!hook) throw new Error('beforeChange hook is missing')
  return hook as unknown as BeforeChangeHook
}

function beforeDeleteHook(): BeforeDeleteHook {
  const hook = SectionDefinitions.hooks?.beforeDelete?.[0]
  if (!hook) throw new Error('beforeDelete hook is missing')
  return hook as unknown as BeforeDeleteHook
}

// A real (non-super-admin) tenant user, so `isEnforced` reads true once past
// the operation/user checks — needed so the entitlement branch is actually
// exercised rather than short-circuited by isEnforced itself.
const tenantUser = { roles: [], tenants: [{ tenant: 5, roles: ['tenant-admin'] }] }

// Throws if queried. Used to prove a branch returns *before* touching the plan,
// not merely that it happens to land on a plan that allows the write.
const poisonedPayload = {
  findByID: async () => {
    throw new Error('should not have queried the plan')
  },
}

const payloadForPlan = (plan: string) => ({ findByID: async () => ({ plan }) })

describe('SectionDefinitions', () => {
  it('is registered with drafts enabled, so an edit cannot redesign live pages', () => {
    expect(SectionDefinitions.versions).toMatchObject({ drafts: true })
  })

  it('accepts a valid recipe', () => {
    expect(recipeValidate()(validRecipe)).toBe(true)
  })

  it('rejects an invalid recipe with the parser error rather than storing it', () => {
    const result = recipeValidate()({ version: 1, container: { width: 'enormous' } })
    expect(typeof result).toBe('string')
    expect(result).not.toBe('')
  })

  it('rejects a recipe that is not an object at all', () => {
    expect(typeof recipeValidate()('nonsense')).toBe('string')
  })

  it('rejects an undefined recipe rather than storing it', () => {
    expect(typeof recipeValidate()(undefined)).toBe('string')
  })

  describe('beforeChange entitlement gate', () => {
    it('returns early on update without consulting the plan', async () => {
      const data = { tenant: 5 }
      const result = await beforeChangeHook()({
        req: { user: tenantUser, payload: poisonedPayload },
        data,
        operation: 'update',
        originalDoc: undefined,
      })
      expect(result).toBe(data)
    })

    it('returns early when isEnforced is false (no user on req)', async () => {
      const data = { tenant: 5 }
      const result = await beforeChangeHook()({
        req: { user: undefined, payload: poisonedPayload },
        data,
        operation: 'create',
        originalDoc: undefined,
      })
      expect(result).toBe(data)
    })

    it('refuses a Free tenant creating a definition, with a Growth-upgrade message', async () => {
      await expect(
        beforeChangeHook()({
          req: { user: tenantUser, payload: payloadForPlan('free') },
          data: { tenant: 5 },
          operation: 'create',
          originalDoc: undefined,
        }),
      ).rejects.toThrow(/Growth/)
    })

    it('allows a Growth tenant to create a definition', async () => {
      const data = { tenant: 5 }
      const result = await beforeChangeHook()({
        req: { user: tenantUser, payload: payloadForPlan('growth') },
        data,
        operation: 'create',
        originalDoc: undefined,
      })
      expect(result).toBe(data)
    })

    it('falls back to originalDoc.tenant when data.tenant is absent', async () => {
      // Free plan + a query that actually ran (proven by the rejection) shows the
      // tenant id was resolved from originalDoc, not silently skipped as undefined.
      await expect(
        beforeChangeHook()({
          req: { user: tenantUser, payload: payloadForPlan('free') },
          data: {},
          operation: 'create',
          originalDoc: { tenant: 5 },
        }),
      ).rejects.toThrow(/Growth/)
    })
  })

  /**
   * getPageBySlug caches pages under `tenant:<id>:pages` for an hour and populates
   * `layout[].definition` at depth 2, so a published definition lives INSIDE that
   * cache entry. Without these hooks a merchant publishes a definition and the
   * storefront renders nothing for up to an hour, and republishing an edited
   * recipe keeps serving the old design, with nothing to indicate why.
   */
  describe('page-cache invalidation', () => {
    beforeEach(() => revalidateTag.mockReset())

    it('purges the tenant page cache when a definition changes', () => {
      const hook = SectionDefinitions.hooks?.afterChange?.[0]
      expect(hook, 'SectionDefinitions has no afterChange hook').toBeTruthy()
      ;(hook as any)({ doc: { tenant: 5 } })
      expect(revalidateTag).toHaveBeenCalledWith('tenant:5:pages', { expire: 0 })
    })

    it('purges the tenant page cache when a definition is deleted', () => {
      const hook = SectionDefinitions.hooks?.afterDelete?.[0]
      expect(hook, 'SectionDefinitions has no afterDelete hook').toBeTruthy()
      ;(hook as any)({ doc: { tenant: { id: 5 } } })
      expect(revalidateTag).toHaveBeenCalledWith('tenant:5:pages', { expire: 0 })
    })
  })

  describe('beforeDelete usage guard', () => {
    it('throws when the definition is still in use', async () => {
      const payload = {
        find: async () => ({ docs: [{ id: 'p1' }] }),
        findVersions: async () => ({ docs: [] }),
      }
      await expect(beforeDeleteHook()({ req: { payload }, id: 'd1' })).rejects.toThrow(/used on 1 page/)
    })

    it('returns cleanly when nothing references the definition', async () => {
      const payload = {
        find: async () => ({ docs: [] }),
        findVersions: async () => ({ docs: [] }),
      }
      await expect(beforeDeleteHook()({ req: { payload }, id: 'd1' })).resolves.toBeUndefined()
    })
  })
})
