// @vitest-environment jsdom
import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

type FieldState = Record<string, { value?: unknown } | undefined>

let fieldState: FieldState = {}
let fieldValue: string | undefined
const setValue = vi.fn()

vi.mock('@payloadcms/ui', () => ({
  // NOTE: a NEW setValue identity on every call, and a NEW fields object from
  // the selector. Payload guarantees neither reference to be stable, and it
  // remounts field components on every write — measured at 3 mounts / 2
  // unmounts for a single write, with refs reset to null. A mock that returns
  // stable references cannot catch an effect that writes on every render, which
  // is how the first version of this component reached the browser with a
  // "Maximum update depth exceeded" loop.
  useField: () => ({ value: fieldValue, setValue: (v: unknown) => setValue(v) }),
  useFormFields: (selector: (args: [FieldState, unknown]) => unknown) =>
    selector([{ ...fieldState }, () => {}]),
}))

const mod = await import('./SlugField')
const SlugField = mod.default as unknown as React.FC<{ path: string; field?: unknown }>

const renderField = () =>
  render(<SlugField path="slug" field={{ label: 'Slug', required: true }} />)

beforeEach(() => {
  setValue.mockReset()
  fieldValue = undefined
  fieldState = {}
})

describe('SlugField', () => {
  it('never writes on its own — derivation is the server hook’s job', () => {
    // The load-bearing property. This component holds no state and writes
    // nothing from an effect, which is what makes a render loop impossible.
    fieldState = { title: { value: 'Plain Sourdough Croissant' }, status: { value: 'draft' } }
    const { rerender } = renderField()
    rerender(<SlugField path="slug" field={{ label: 'Slug', required: true }} />)
    rerender(<SlugField path="slug" field={{ label: 'Slug', required: true }} />)
    expect(setValue).not.toHaveBeenCalled()
  })

  it('previews the slug the server will generate, as a placeholder', () => {
    fieldState = { title: { value: 'Cheese & Zaatar Croissant' } }
    const { container } = renderField()
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.placeholder).toBe('cheese-zaatar-croissant')
    expect(input.value).toBe('')
  })

  it('offers no placeholder when the title cannot make a valid slug', () => {
    fieldState = { title: { value: 'A' } }
    const { container } = renderField()
    expect((container.querySelector('input') as HTMLInputElement).placeholder).toBe('')
  })

  it('tells the merchant what will be used when they leave it blank', () => {
    fieldState = { title: { value: 'Zaatar Croissant' } }
    const { container } = renderField()
    expect(container.textContent).toContain('zaatar-croissant')
  })

  it('warns about breaking links once a slug exists', () => {
    fieldValue = 'zaatar-croissant'
    fieldState = { title: { value: 'Zaatar Croissant' } }
    const { container } = renderField()
    expect(container.textContent).toMatch(/breaks existing links/i)
  })

  it('writes only what the merchant types', () => {
    fieldState = { title: { value: 'Croissant' } }
    const { container } = renderField()
    const input = container.querySelector('input') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!
    setter.call(input, 'my-own-slug')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(setValue).toHaveBeenCalledTimes(1)
    expect(setValue).toHaveBeenCalledWith('my-own-slug')
  })
})
