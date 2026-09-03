import { describe, expect, it, vi } from 'vitest'
import { Products } from './Products'
// Plan-backed entitlements so the refusal paths below are exercised in both the
// private repo and the OSS export (whose real overlay grants everything).
vi.mock('@/entitlements-overlay', () => import('@/test-utils/fake-entitlements'))


type AnyField = {
  name?: string
  type?: string
  fields?: AnyField[]
  label?: unknown
  options?: unknown[]
  admin?: { position?: string; initCollapsed?: boolean; description?: string }
}

const fields = Products.fields as unknown as AnyField[]

/** Field names in document order, descending through presentational wrappers. */
function flatNames(list: AnyField[]): string[] {
  return list.flatMap((f) =>
    f.type === 'collapsible' || f.type === 'row'
      ? flatNames(f.fields ?? [])
      : f.name
        ? [f.name]
        : [],
  )
}

function findField(list: AnyField[], name: string): AnyField | undefined {
  for (const f of list) {
    if (f.name === name) return f
    const nested = f.fields ? findField(f.fields, name) : undefined
    if (nested) return nested
  }
  return undefined
}

describe('Products field config', () => {
  it('puts options before variants so the helper text is true', () => {
    // VariantOptionValues renders "Define product options above to tag this
    // variant." That sentence must not lie.
    const names = flatNames(fields)
    expect(names.indexOf('options')).toBeGreaterThan(-1)
    expect(names.indexOf('options')).toBeLessThan(names.indexOf('variants'))
  })

  it('never wraps options or variants in a named group', () => {
    // A `group` owns a data path; `collapsible` does not. Wrapping options in a
    // group moves it from fields['options'] to fields['<group>.options'] and
    // silently breaks readAxes() in VariantOptionValues.
    const groupsWithName = (list: AnyField[]): AnyField[] =>
      list.flatMap((f) => [
        ...(f.type === 'group' && f.name ? [f] : []),
        ...(f.fields ? groupsWithName(f.fields) : []),
      ])
    for (const g of groupsWithName(fields)) {
      const inner = flatNames(g.fields ?? [])
      expect(inner).not.toContain('options')
      expect(inner).not.toContain('variants')
    }
  })

  it('moves status and slug to the sidebar', () => {
    expect(findField(fields, 'status')?.admin?.position).toBe('sidebar')
    expect(findField(fields, 'slug')?.admin?.position).toBe('sidebar')
  })

  it('collapses variants and specifications by default, but not pricing', () => {
    const collapsibles = fields.filter((f) => f.type === 'collapsible')
    const byLabel = (l: string) => collapsibles.find((c) => c.label === l)
    expect(byLabel('Pricing & stock')?.admin?.initCollapsed).toBeFalsy()
    expect(byLabel('Variants & options')?.admin?.initCollapsed).toBe(true)
    expect(byLabel('Specifications')?.admin?.initCollapsed).toBe(true)
  })

  it('keeps every field it had before — nothing renamed or dropped', () => {
    const names = flatNames(fields)
    for (const expected of [
      'title',
      'slug',
      'description',
      'images',
      'category',
      'status',
      'price',
      'stock',
      'variants',
      'options',
      'specifications',
    ]) {
      expect(names, `${expected} is missing`).toContain(expected)
    }
  })

  it('labels status for humans instead of showing raw values', () => {
    const status = findField(fields, 'status') as { options?: unknown[] }
    expect(status.options).toEqual([
      { label: 'Draft', value: 'draft' },
      { label: 'Active', value: 'active' },
    ])
  })

  it('warns that zero stock reads as out of stock', () => {
    const stock = findField(fields, 'stock') as { admin?: { description?: string } }
    expect(stock.admin?.description ?? '').toMatch(/out of stock/i)
  })
})

// The beforeValidate hook is a pure function of ({ data }), so it can be
// invoked directly. This is where slug derivation lives — see SlugField.tsx for
// why it cannot live in the admin component.
type BeforeValidate = (args: { data?: Record<string, unknown> }) => Record<string, unknown> | undefined
// `the hosted tenant-scoping wrapper` PREPENDS `assignMcpHostTenant` to beforeValidate
// (see access/tenantScopedAccess.ts), so the collection's own hook is last —
// index 0 is the tenant hook and needs a real `req`.
const hooks = (Products.hooks?.beforeValidate ?? []) as unknown[]
const beforeValidate = hooks[hooks.length - 1] as BeforeValidate

describe('Products slug derivation', () => {
  it('fills an empty slug from the title', () => {
    const out = beforeValidate({ data: { title: 'Cheese & Zaatar Croissant' } })
    expect(out?.slug).toBe('cheese-zaatar-croissant')
  })

  it('never overwrites a slug the merchant already has', () => {
    // An existing slug is a live storefront URL. Rewriting it breaks links.
    const out = beforeValidate({ data: { title: 'Renamed Product', slug: 'original-url' } })
    expect(out?.slug).toBe('original-url')
  })

  it('leaves the slug empty when the title cannot produce a valid one', () => {
    // Server-side `required` + format validation then reports it properly,
    // rather than us writing a value that would fail validation anyway.
    expect(beforeValidate({ data: { title: 'A' } })?.slug).toBeUndefined()
    expect(beforeValidate({ data: { title: '!!!' } })?.slug).toBeUndefined()
  })

  it('does nothing when there is no title yet', () => {
    expect(beforeValidate({ data: {} })?.slug).toBeUndefined()
  })

  it('still auto-titles variants from options', () => {
    // The hook had one job before this change; it must keep doing it.
    const out = beforeValidate({
      data: {
        title: 'Tee',
        options: [{ name: 'Size', values: [{ value: 'S' }] }],
        variants: [{ optionValues: [{ option: 'Size', value: 'S' }] }],
      },
    })
    expect((out?.variants as { title?: string }[])[0].title).toBe('S')
  })
})

// The beforeChange hook is the only mutating hook on this collection, so
// `beforeChange[0]` is the collection's own function — the hosted tenant-scoping wrapper
// only prepends to beforeValidate (see access/tenantScopedAccess.ts).
type BeforeChange = (args: {
  req: { user?: unknown; payload: unknown }
  operation: 'create' | 'update'
  data?: Record<string, unknown>
  originalDoc?: Record<string, unknown>
}) => Promise<Record<string, unknown> | undefined>
const beforeChange = (Products.hooks?.beforeChange ?? [])[0] as unknown as BeforeChange

const tenantAdmin = { tenants: [{ tenant: 1, roles: ['tenant-admin'] }] }
const fakePayload = (plan: string) => ({
  findByID: vi.fn().mockResolvedValue({ plan }),
  count: vi.fn().mockResolvedValue({ totalDocs: 0 }),
})

describe('Products gift-card entitlement gate', () => {
  // Covers the decision from code review: gate the TRANSITION (flag going
  // off -> on), never the steady state, so a downgraded merchant is never
  // blocked from saving an unrelated edit on a product that already issues
  // gift cards — the same reasoning as assertCustomDomain and assertCustomCss.

  it('refuses turning the flag on without the entitlement', async () => {
    const req = { user: tenantAdmin, payload: fakePayload('free') }
    await expect(
      beforeChange({
        req,
        operation: 'update',
        data: { tenant: 1, issuesGiftCard: true },
        originalDoc: { issuesGiftCard: false },
      }),
    ).rejects.toThrow(/Growth plan/)
  })

  it('allows turning the flag on with the Growth entitlement', async () => {
    const req = { user: tenantAdmin, payload: fakePayload('growth') }
    await expect(
      beforeChange({
        req,
        operation: 'update',
        data: { tenant: 1, issuesGiftCard: true },
        originalDoc: { issuesGiftCard: false },
      }),
    ).resolves.toBeDefined()
  })

  it('grandfathers an already-issuing product through a downgrade: steady state is never re-gated', async () => {
    // The case that encodes the decision. Without the transition check, every
    // save of an already-configured product would re-run entitlement and
    // strand a downgraded merchant on an unrelated edit.
    const req = { user: tenantAdmin, payload: fakePayload('free') }
    await expect(
      beforeChange({
        req,
        operation: 'update',
        data: { tenant: 1, issuesGiftCard: true },
        originalDoc: { issuesGiftCard: true },
      }),
    ).resolves.toBeDefined()
  })
})
