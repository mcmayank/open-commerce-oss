import { describe, expect, it } from 'vitest'
import type { ThemeFieldDef } from '@/themes/types'
import { parseInputValue, readThemeValue, setThemeValue } from './state'

const textField: ThemeFieldDef = { name: 'headline', type: 'text', label: 'Headline', default: 'Hi' }
const numField: ThemeFieldDef = { name: 'cols', type: 'number', label: 'Cols', default: 2 }
const boolField: ThemeFieldDef = { name: 'show', type: 'boolean', label: 'Show', default: true }

describe('readThemeValue', () => {
  it('returns the stored value when present', () => {
    expect(readThemeValue({ editorial: { headline: 'Set' } }, 'editorial', textField)).toBe('Set')
  })

  it('falls back to the field default when unset', () => {
    expect(readThemeValue({}, 'editorial', textField)).toBe('Hi')
    expect(readThemeValue(null, 'editorial', textField)).toBe('Hi')
  })

  it('returns a stored falsy value rather than the default', () => {
    expect(readThemeValue({ editorial: { show: false } }, 'editorial', boolField)).toBe(false)
  })
})

describe('setThemeValue', () => {
  it('sets a value under the slug immutably', () => {
    const before = { editorial: { headline: 'Old' } }
    const after = setThemeValue(before, 'editorial', 'headline', 'New')
    expect(after).toEqual({ editorial: { headline: 'New' } })
    expect(before).toEqual({ editorial: { headline: 'Old' } }) // unchanged
  })

  it('preserves other fields under the same slug', () => {
    const after = setThemeValue({ editorial: { headline: 'Hi' } }, 'editorial', 'accent', '#fff')
    expect(after.editorial).toEqual({ headline: 'Hi', accent: '#fff' })
  })

  it('preserves other themes’ config (switching themes never drops it)', () => {
    const after = setThemeValue({ 'sd-bakery': { x: 1 } }, 'editorial', 'headline', 'Hi')
    expect(after).toEqual({ 'sd-bakery': { x: 1 }, editorial: { headline: 'Hi' } })
  })

  it('handles a null/empty starting value', () => {
    expect(setThemeValue(null, 'editorial', 'headline', 'Hi')).toEqual({ editorial: { headline: 'Hi' } })
  })
})

describe('parseInputValue', () => {
  it('parses number inputs to a finite number', () => {
    expect(parseInputValue(numField, '3')).toBe(3)
  })

  it('returns undefined for a non-numeric number input', () => {
    expect(parseInputValue(numField, '')).toBe(undefined)
  })

  it('coerces boolean inputs', () => {
    expect(parseInputValue(boolField, true)).toBe(true)
    expect(parseInputValue(boolField, false)).toBe(false)
  })

  it('passes string inputs through unchanged', () => {
    expect(parseInputValue(textField, 'Hello')).toBe('Hello')
  })
})
