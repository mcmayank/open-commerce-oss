import { describe, expect, it } from 'vitest'
import { itemCountOf, slotFieldsOf } from './recipe-slot-fields'
import { SECTION_PRESETS } from '@/blocks/recipe/presets'

const byId = (id: string) => SECTION_PRESETS.find((p) => p.id === id)!.recipe

describe('slotFieldsOf', () => {
  it('emits one field per declared slot, header first', () => {
    const fields = slotFieldsOf(byId('portraitCards'))
    expect(fields.map((f) => f.name)).toEqual(['title', 'image', 'label', 'cardTitle', 'body'])
    expect(fields[0].scope).toBe('header')
    expect(fields[1].scope).toBe('item')
  })

  it('types each input by atom kind', () => {
    const byName = Object.fromEntries(slotFieldsOf(byId('portraitCards')).map((f) => [f.name, f.input]))
    expect(byName).toMatchObject({ image: 'media', label: 'text', cardTitle: 'text', body: 'textarea' })
  })

  it('emits both slots of a link, and types the destination as a url', () => {
    const byName = Object.fromEntries(slotFieldsOf(byId('peopleGrid')).map((f) => [f.name, f.input]))
    expect(byName.linkLabel).toBe('text')
    expect(byName.linkHref).toBe('url')
  })

  it('types an icon slot as an icon picker', () => {
    const byName = Object.fromEntries(slotFieldsOf(byId('ctaCards')).map((f) => [f.name, f.input]))
    expect(byName.icon).toBe('icon')
  })

  it('emits no field for a badge that numbers itself', () => {
    const recipe = {
      ...byId('portraitCards'),
      items: {
        ...byId('portraitCards').items!,
        template: [{ kind: 'badge' as const, source: 'index' as const }],
      },
    }
    expect(slotFieldsOf(recipe).filter((f) => f.scope === 'item')).toEqual([])
  })

  it('carries the slot label through, since that is what the merchant reads', () => {
    expect(slotFieldsOf(byId('portraitCards')).find((f) => f.name === 'cardTitle')?.label).toBe('Title')
  })
})

describe('itemCountOf', () => {
  it('reads the recipe\'s own declared item count', () => {
    expect(itemCountOf(byId('portraitCards'))).toBe(3)
    expect(itemCountOf(byId('captionedImages'))).toBe(6)
  })

  it('is zero for a recipe with no items block at all', () => {
    const { items: _items, ...headerOnly } = byId('portraitCards')
    expect(itemCountOf(headerOnly)).toBe(0)
  })
})
