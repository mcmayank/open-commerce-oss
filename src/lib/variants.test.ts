import { describe, expect, it } from 'vitest'
import {
  deriveVariantTitle,
  resolveVariant,
  availableValues,
  variantPriceRange,
  isCompleteSelection,
  type ProductOption,
  type ProductVariant,
} from './variants'

const options: ProductOption[] = [
  { name: 'Size', values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }] },
  { name: 'Color', values: [{ value: 'Red' }, { value: 'Blue' }] },
]

const variants: ProductVariant[] = [
  { id: 'a', price: 1000, stock: 4, optionValues: [{ option: 'Size', value: 'M' }, { option: 'Color', value: 'Red' }] },
  { id: 'b', price: 1400, stock: 0, optionValues: [{ option: 'Size', value: 'L' }, { option: 'Color', value: 'Blue' }] },
  { id: 'c', price: 1200, stock: 2, optionValues: [{ option: 'Size', value: 'M' }, { option: 'Color', value: 'Blue' }] },
]

describe('deriveVariantTitle', () => {
  it('joins values in axis order', () => {
    expect(deriveVariantTitle([{ option: 'Color', value: 'Red' }, { option: 'Size', value: 'M' }], options)).toBe('M / Red')
  })
  it('skips axes with no chosen value', () => {
    expect(deriveVariantTitle([{ option: 'Size', value: 'M' }], options)).toBe('M')
  })
  it('returns empty string when nothing is tagged', () => {
    expect(deriveVariantTitle([], options)).toBe('')
    expect(deriveVariantTitle(null, options)).toBe('')
  })
})

describe('resolveVariant', () => {
  it('resolves a complete selection to its row', () => {
    expect(resolveVariant({ Size: 'M', Color: 'Blue' }, variants, options)?.id).toBe('c')
  })
  it('returns null for an incomplete selection', () => {
    expect(resolveVariant({ Size: 'M' }, variants, options)).toBeNull()
  })
  it('returns null when no row matches', () => {
    expect(resolveVariant({ Size: 'S', Color: 'Red' }, variants, options)).toBeNull()
  })
})

describe('availableValues', () => {
  it('lists all values that exist for an axis with no other selection', () => {
    expect([...availableValues('Color', {}, variants, options)].sort()).toEqual(['Blue', 'Red'])
  })
  it('narrows based on the rest of the selection', () => {
    // With Size=L only L/Blue exists, so Color can only be Blue
    expect([...availableValues('Color', { Size: 'L' }, variants, options)]).toEqual(['Blue'])
  })
  it('ignores its own axis when computing availability', () => {
    // Choosing Size=M must not restrict which Sizes are offered
    expect([...availableValues('Size', { Size: 'M' }, variants, options)].sort()).toEqual(['L', 'M'])
  })
})

describe('variantPriceRange', () => {
  it('returns min and max across rows', () => {
    expect(variantPriceRange(variants)).toEqual({ min: 1000, max: 1400 })
  })
  it('returns zeros for an empty list', () => {
    expect(variantPriceRange([])).toEqual({ min: 0, max: 0 })
  })
})

describe('isCompleteSelection', () => {
  it('is true only when every axis has a value', () => {
    expect(isCompleteSelection({ Size: 'M', Color: 'Red' }, options)).toBe(true)
    expect(isCompleteSelection({ Size: 'M' }, options)).toBe(false)
  })
})
