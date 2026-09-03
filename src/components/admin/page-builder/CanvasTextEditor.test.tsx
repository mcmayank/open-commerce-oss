/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { fieldPath } from '@/lib/page-builder/edit-target'
import { CanvasTextEditor } from './CanvasTextEditor'

const setValue = vi.fn()
// Typed with its argument (the brief's `vi.fn(() => …)` is inferred as taking
// zero arguments, which `npx tsc --noEmit` rejects at the call site below).
const useFieldSpy = vi.fn((_args: { path: string }) => ({ setValue }))
vi.mock('@payloadcms/ui', () => ({ useField: (args: unknown) => useFieldSpy(args as { path: string }) }))

afterEach(() => {
  cleanup()
  setValue.mockReset()
  useFieldSpy.mockClear()
})

const rect = { top: 10, left: 20, width: 300, height: 40 }

describe('CanvasTextEditor', () => {
  it('seeds the input with the field value', () => {
    render(<CanvasTextEditor path="layout.0.heading" initialValue="Fresh bread" rect={rect} scale={1} onClose={vi.fn()} />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Fresh bread')
  })

  it('commits on Enter through the form-state path and closes', () => {
    const onClose = vi.fn()
    render(<CanvasTextEditor path="layout.0.heading" initialValue="Fresh bread" rect={rect} scale={1} onClose={onClose} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Warm bread' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(setValue).toHaveBeenCalledWith('Warm bread')
    expect(onClose).toHaveBeenCalled()
  })

  it('commits on blur, so clicking away does not silently discard the edit', () => {
    render(<CanvasTextEditor path="layout.0.heading" initialValue="Fresh bread" rect={rect} scale={1} onClose={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Warm bread' } })
    fireEvent.blur(input)
    expect(setValue).toHaveBeenCalledWith('Warm bread')
  })

  it('discards on Escape without writing', () => {
    const onClose = vi.fn()
    render(<CanvasTextEditor path="layout.0.heading" initialValue="Fresh bread" rect={rect} scale={1} onClose={onClose} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Warm bread' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(setValue).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('does not write when the value is unchanged, so no spurious draft is created', () => {
    render(<CanvasTextEditor path="layout.0.heading" initialValue="Fresh bread" rect={rect} scale={1} onClose={vi.fn()} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(setValue).not.toHaveBeenCalled()
  })

  // The spec's risk section demands a test that a canvas edit and an inspector
  // edit produce identical form state. Assert the PATH, against the shared
  // builder — an assertion that a string matches a regex would pass even if
  // the editor wrote somewhere else entirely.
  it('writes through the same path the inspector binds for that row and field', () => {
    const path = fieldPath(2, 'heading')
    render(<CanvasTextEditor path={path} initialValue="a" rect={rect} scale={1} onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'b' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    // useField was constructed with exactly that path, and setValue wrote to it.
    expect(useFieldSpy).toHaveBeenCalledWith({ path: 'layout.2.heading' })
    expect(setValue).toHaveBeenCalledWith('b')
  })

  it('positions itself in scaled canvas coordinates', () => {
    render(<CanvasTextEditor path="layout.0.heading" initialValue="x" rect={rect} scale={0.5} onClose={vi.fn()} />)
    const box = screen.getByRole('textbox').parentElement as HTMLElement
    expect(box.style.top).toBe('5px')
    expect(box.style.left).toBe('10px')
    expect(box.style.width).toBe('150px')
  })
})
