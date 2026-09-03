import { describe, it, expect } from 'vitest'
import {
  resolveControlOrigin,
  countGroupOverrides,
  countOverrides,
  optionLabel,
} from './origin'
import type { BlockStyle } from './vocabulary'

const EMPTY: BlockStyle = {}

describe('resolveControlOrigin', () => {
  it('reports theme when neither layer sets the control', () => {
    expect(resolveControlOrigin(EMPTY, EMPTY, 'heading', 'size')).toEqual({ kind: 'theme' })
  })

  it('reports the store default when only the store layer sets it', () => {
    const store: BlockStyle = { heading: { font: 'display' } }
    expect(resolveControlOrigin(EMPTY, store, 'heading', 'font')).toEqual({
      kind: 'store',
      value: 'display',
      label: 'Display',
    })
  })

  it('reports an instance override when the instance sets it, even if the store also does', () => {
    const instance: BlockStyle = { heading: { size: '2xl' } }
    const store: BlockStyle = { heading: { size: 'lg' } }
    expect(resolveControlOrigin(instance, store, 'heading', 'size')).toEqual({
      kind: 'instance',
      value: '2xl',
      label: '2XL',
    })
  })

  it('treats an empty string as unset, matching the panel\'s "Default" option', () => {
    const instance = { heading: { size: '' } } as unknown as BlockStyle
    expect(resolveControlOrigin(instance, EMPTY, 'heading', 'size')).toEqual({ kind: 'theme' })
  })
})

describe('countGroupOverrides / countOverrides', () => {
  it('counts only instance-set controls', () => {
    const instance: BlockStyle = { heading: { size: '2xl', weight: '600' }, eyebrow: {} }
    expect(countGroupOverrides(instance, 'heading')).toBe(2)
    expect(countGroupOverrides(instance, 'eyebrow')).toBe(0)
  })

  it('sums across only the groups it is asked about', () => {
    const instance: BlockStyle = { heading: { size: '2xl' }, media: { radius: 'lg' } }
    expect(countOverrides(instance, ['heading'])).toBe(1)
    expect(countOverrides(instance, ['heading', 'media'])).toBe(2)
    expect(countOverrides(instance, [])).toBe(0)
  })

  it('does not count a control the block cannot use, so a hidden group never inflates the badge', () => {
    const instance: BlockStyle = { heading: { size: '2xl' }, accent: { italic: 'on' } }
    expect(countOverrides(instance, ['heading'])).toBe(1)
  })
})

describe('optionLabel', () => {
  it('maps a stored value back to its admin-facing label', () => {
    expect(optionLabel('heading', 'weight', '700')).toBe('Bold')
  })

  it('returns undefined for a value no longer in the vocabulary', () => {
    expect(optionLabel('heading', 'weight', '999')).toBeUndefined()
  })
})
