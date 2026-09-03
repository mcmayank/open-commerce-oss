// @vitest-environment jsdom
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * Payload 3 does NOT put an array's contents in `fields['<path>'].value`.
 * `addFieldStatePromise` sets:
 *
 *   fieldState.value = forceFullValue ? arrayValue : arrayValue.length
 *
 * so `value` is the ROW COUNT (a number). The rows themselves are flattened
 * into sibling paths — `options.0.name`, `options.0.values.0.value` — with row
 * identity in `fields['<path>'].rows`.
 *
 * Reading `.value` and treating it as an array therefore blows up the moment a
 * product has at least one option, which is what this suite pins down.
 */

type FieldState = Record<string, { value: unknown; rows?: { id: string }[] }>

/** Form state exactly as Payload builds it for one axis: Size with S and M. */
const ONE_AXIS: FieldState = {
  options: { value: 1, rows: [{ id: 'row-1' }] },
  'options.0.id': { value: 'row-1' },
  'options.0.name': { value: 'Size' },
  'options.0.values': { value: 2, rows: [{ id: 'v1' }, { id: 'v2' }] },
  'options.0.values.0.id': { value: 'v1' },
  'options.0.values.0.value': { value: 'S' },
  'options.0.values.1.id': { value: 'v2' },
  'options.0.values.1.value': { value: 'M' },
}

/** A product with no options at all — `value` is 0, still a number. */
const NO_AXES: FieldState = { options: { value: 0, rows: [] } }

let fieldState: FieldState = NO_AXES
const setValue = vi.fn()

vi.mock('@payloadcms/ui', () => ({
  useField: () => ({ value: [], setValue }),
  // Payload calls the selector with [fields, dispatch]; only fields matter here.
  useFormFields: (selector: (args: [FieldState, unknown]) => unknown) =>
    selector([fieldState, () => {}]),
  FieldLabel: ({ label }: { label: string }) => <span>{label}</span>,
}))

const mod = await import('./VariantOptionValues')
const { readAxes } = mod
// The component's real prop type is Payload's full ArrayFieldClientComponent
// contract; it only reads `path`, so narrow it rather than fabricate the rest.
const VariantOptionValues = mod.default as unknown as React.FC<{ path: string }>

describe('readAxes', () => {
  it('reads axes from the flattened paths, not from .value', () => {
    expect(readAxes(ONE_AXIS)).toEqual([{ name: 'Size', values: [{ value: 'S' }, { value: 'M' }] }])
  })

  it('returns nothing when the product has no options', () => {
    expect(readAxes(NO_AXES)).toEqual([])
  })

  it('handles multiple axes', () => {
    expect(
      readAxes({
        options: { value: 2 },
        'options.0.name': { value: 'Size' },
        'options.0.values': { value: 1 },
        'options.0.values.0.value': { value: 'S' },
        'options.1.name': { value: 'Colour' },
        'options.1.values': { value: 1 },
        'options.1.values.0.value': { value: 'Red' },
      }),
    ).toEqual([
      { name: 'Size', values: [{ value: 'S' }] },
      { name: 'Colour', values: [{ value: 'Red' }] },
    ])
  })

  it('skips an axis whose name has not been typed yet', () => {
    // Payload creates the row the instant "Add option" is clicked, before the
    // merchant types anything — a nameless select would be meaningless.
    expect(readAxes({ options: { value: 1 }, 'options.0.name': { value: '' } })).toEqual([])
    expect(readAxes({ options: { value: 1 } })).toEqual([])
  })

  it('keeps an axis that has a name but no values yet', () => {
    expect(readAxes({ options: { value: 1 }, 'options.0.name': { value: 'Size' } })).toEqual([
      { name: 'Size', values: [] },
    ])
  })

  it('prefers rows[] for the count when present', () => {
    // Payload populates `rows` for row identity; `value` can lag mid-edit.
    expect(
      readAxes({
        options: { value: undefined, rows: [{ id: 'a' }] },
        'options.0.name': { value: 'Size' },
        'options.0.values': { rows: [{ id: 'x' }], value: undefined },
        'options.0.values.0.value': { value: 'S' },
      }),
    ).toEqual([{ name: 'Size', values: [{ value: 'S' }] }])
  })
})

describe('VariantOptionValues', () => {
  it('prompts to define options when the product has none', () => {
    fieldState = NO_AXES
    render(<VariantOptionValues path="variants.0.optionValues" />)
    expect(screen.getByText(/Define product options above/i)).toBeTruthy()
  })

  it('renders a select per axis once an option exists', () => {
    // This is the reported bug: adding an option to a product that already has
    // a variant row crashes the variant's Options field.
    fieldState = ONE_AXIS
    render(<VariantOptionValues path="variants.0.optionValues" />)
    expect(screen.getByText('Size')).toBeTruthy()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['', 'S', 'M'])
  })
})
