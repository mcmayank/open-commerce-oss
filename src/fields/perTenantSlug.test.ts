import { describe, it, expect } from 'vitest'
import { perTenantSlugField } from './perTenantSlug'

// The field's `validate` runs the format + reserved checks before it ever touches
// `req.payload`, so those branches are testable with a minimal context.
type Validate = (
  value: unknown,
  ctx: { req?: unknown; data?: unknown; id?: unknown },
) => Promise<string | true>

const getValidate = (opts?: { reserved?: string[] }): Validate =>
  (perTenantSlugField('pages', opts) as any).validate

describe('perTenantSlugField reserved slugs', () => {
  it('rejects a reserved slug with a clear error', async () => {
    const validate = getValidate({ reserved: ['cart', 'products', 'checkout'] })
    const result = await validate('cart', { req: {}, data: { tenant: 1 } })
    expect(typeof result).toBe('string')
    expect(result).toContain('reserved')
  })

  it('allows a non-reserved, format-valid slug', async () => {
    const validate = getValidate({ reserved: ['cart'] })
    // No tenant/payload in context → the conflict query is skipped and it returns true.
    const result = await validate('about-us', { req: {}, data: {} })
    expect(result).toBe(true)
  })

  it('applies no reservations when none are configured (e.g. products)', async () => {
    const validate = getValidate()
    const result = await validate('cart', { req: {}, data: {} })
    expect(result).toBe(true)
  })

  it('rejects an invalid slug format before the reserved check', async () => {
    const validate = getValidate({ reserved: ['cart'] })
    const result = await validate('A', { req: {}, data: {} })
    expect(typeof result).toBe('string')
    expect(result).toContain('lowercase')
  })
})

type AdminShape = { position?: string; description?: string; components?: { Field?: string } }
const admin = (f: unknown) => ((f as { admin?: AdminShape }).admin ?? {}) as AdminShape

describe('perTenantSlugField admin options', () => {
  it('is a plain text field by default — Pages must be unaffected', () => {
    const f = perTenantSlugField('pages')
    expect(admin(f).components?.Field).toBeUndefined()
    expect(admin(f).position).toBeUndefined()
  })

  it('attaches SlugField only when autoDerive is requested', () => {
    const f = perTenantSlugField('products', { autoDerive: true })
    expect(admin(f).components?.Field).toBe('@/components/admin/SlugField')
  })

  it('moves to the sidebar only when asked', () => {
    expect(admin(perTenantSlugField('products', { position: 'sidebar' })).position).toBe('sidebar')
  })

  it('keeps the existing description in every mode', () => {
    for (const f of [
      perTenantSlugField('pages'),
      perTenantSlugField('products', { autoDerive: true, position: 'sidebar' }),
    ]) {
      expect(admin(f).description).toContain('URL-safe')
    }
  })
})
