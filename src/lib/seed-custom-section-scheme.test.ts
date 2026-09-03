import { describe, expect, it } from 'vitest'
import { seedCustomSectionSchemes } from './seed-custom-section-scheme'

type Args = Parameters<typeof seedCustomSectionSchemes>[0]

const recipe = (scheme: string) => ({
  version: 1,
  container: { width: 'wide', padding: 'normal', scheme, align: 'center' },
  header: { heading: { name: 'title', label: 'Title' } },
})

const payloadReturning = (doc: unknown) =>
  ({ findByID: async () => doc }) as unknown as Args

describe('seedCustomSectionSchemes', () => {
  it('fills an empty scheme on a newly-placed block from the published definition', async () => {
    const layout = [{ id: 'b1', blockType: 'customSection', definition: 'd1' }]
    await seedCustomSectionSchemes(payloadReturning({ _status: 'published', recipe: recipe('muted') }), layout, null)
    expect((layout[0] as { scheme?: string }).scheme).toBe('muted')
  })

  it('never overwrites a scheme the merchant already chose on a newly-placed block', async () => {
    const layout = [{ id: 'b1', blockType: 'customSection', definition: 'd1', scheme: 'inverse' }]
    await seedCustomSectionSchemes(payloadReturning({ _status: 'published', recipe: recipe('muted') }), layout, null)
    expect((layout[0] as { scheme?: string }).scheme).toBe('inverse')
  })

  it('leaves scheme unset when the definition has no published version', async () => {
    const layout = [{ id: 'b1', blockType: 'customSection', definition: 'd1' }]
    await seedCustomSectionSchemes(payloadReturning({ _status: 'draft', recipe: recipe('muted') }), layout, null)
    expect((layout[0] as { scheme?: string }).scheme).toBeUndefined()
  })

  it('reads the id out of an already-populated relationship and passes it to findByID', async () => {
    const seen: unknown[] = []
    const payload = {
      findByID: async ({ id }: { id: unknown }) => {
        seen.push(id)
        return { _status: 'published', recipe: recipe('accent') }
      },
    } as unknown as Args
    const layout = [{ id: 'b1', blockType: 'customSection', definition: { id: 'd1' } }]
    await seedCustomSectionSchemes(payload, layout, null)
    expect(seen).toEqual(['d1'])
    expect((layout[0] as { scheme?: string }).scheme).toBe('accent')
  })

  it('never fails a page save when the definition cannot be read', async () => {
    const layout = [{ id: 'b1', blockType: 'customSection', definition: 'gone' }]
    const payload = {
      findByID: async () => {
        throw new Error('not found')
      },
    } as unknown as Args
    await expect(seedCustomSectionSchemes(payload, layout, null)).resolves.toBeUndefined()
    expect((layout[0] as { scheme?: string }).scheme).toBeUndefined()
  })

  it('never fails a page save when the stored recipe is invalid', async () => {
    const layout = [{ id: 'b1', blockType: 'customSection', definition: 'd1' }]
    await seedCustomSectionSchemes(payloadReturning({ _status: 'published', recipe: { nope: true } }), layout, null)
    expect((layout[0] as { scheme?: string }).scheme).toBeUndefined()
  })

  it('ignores other block types even when they carry a definition', async () => {
    const layout = [{ id: 'b1', blockType: 'hero', definition: 'd1' }]
    await seedCustomSectionSchemes(payloadReturning({ _status: 'published', recipe: recipe('muted') }), layout, null)
    expect((layout[0] as { scheme?: string }).scheme).toBeUndefined()
  })

  it('keeps an explicit "Theme default" (empty string) scheme on a block that already existed', async () => {
    const originalLayout = [{ id: 'b1', blockType: 'customSection', definition: 'd1', scheme: '' }]
    const layout = [{ id: 'b1', blockType: 'customSection', definition: 'd1', scheme: '' }]
    await seedCustomSectionSchemes(
      payloadReturning({ _status: 'published', recipe: recipe('muted') }),
      layout,
      originalLayout,
    )
    expect((layout[0] as { scheme?: string }).scheme).toBe('')
  })

  it('keeps a non-empty scheme on a block that already existed', async () => {
    const originalLayout = [{ id: 'b1', blockType: 'customSection', definition: 'd1', scheme: 'inverse' }]
    const layout = [{ id: 'b1', blockType: 'customSection', definition: 'd1', scheme: 'inverse' }]
    await seedCustomSectionSchemes(
      payloadReturning({ _status: 'published', recipe: recipe('muted') }),
      layout,
      originalLayout,
    )
    expect((layout[0] as { scheme?: string }).scheme).toBe('inverse')
  })

  it('still seeds a block with an id absent from originalLayout', async () => {
    const originalLayout = [{ id: 'other', blockType: 'customSection', definition: 'd2' }]
    const layout = [
      { id: 'other', blockType: 'customSection', definition: 'd2', scheme: 'inverse' },
      { id: 'b1', blockType: 'customSection', definition: 'd1' },
    ]
    await seedCustomSectionSchemes(
      payloadReturning({ _status: 'published', recipe: recipe('muted') }),
      layout,
      originalLayout,
    )
    expect((layout[1] as { scheme?: string }).scheme).toBe('muted')
  })

  it('still seeds a block with no id at all', async () => {
    const layout = [{ blockType: 'customSection', definition: 'd1' }]
    await seedCustomSectionSchemes(
      payloadReturning({ _status: 'published', recipe: recipe('muted') }),
      layout,
      [{ id: 'b1', blockType: 'customSection', definition: 'd1' }],
    )
    expect((layout[0] as { scheme?: string }).scheme).toBe('muted')
  })

  it('seeds everything when originalLayout is null', async () => {
    const layout = [{ id: 'b1', blockType: 'customSection', definition: 'd1' }]
    await seedCustomSectionSchemes(payloadReturning({ _status: 'published', recipe: recipe('muted') }), layout, null)
    expect((layout[0] as { scheme?: string }).scheme).toBe('muted')
  })
})
