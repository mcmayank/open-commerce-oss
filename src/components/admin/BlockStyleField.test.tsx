/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import BlockStyleField from './BlockStyleField'

const setValue = vi.fn() // blockStyles field
let mockBlockStylesValue: Record<string, unknown> = {}
// Flat form-state entries keyed by dotted path, e.g. 'layout.0.blockType' —
// mirrors how Payload's real useFormFields exposes sibling fields, and matches
// the pattern BlockInspector.test.tsx already uses for the same hooks.
let mockFlatFields: Record<string, { value?: unknown }> = {}

vi.mock('@payloadcms/ui', () => ({
  useField: (opts: { path: string }) => {
    if (opts.path === 'blockStyles') return { value: mockBlockStylesValue, setValue }
    return { value: undefined, setValue: vi.fn() }
  },
  useFormFields: (selector: (args: [Record<string, unknown>]) => unknown) => selector([mockFlatFields]),
}))

afterEach(() => {
  cleanup()
  setValue.mockReset()
  mockBlockStylesValue = {}
  mockFlatFields = {}
})

/** The component takes Payload's UI-field props; tests only ever set `path`. */
const Field = BlockStyleField as unknown as React.ComponentType<{ path: string }>

describe('BlockStyleField', () => {
  it('reads the sibling blockType from the correct form-state path and renders that block type\'s groups', () => {
    // Regression coverage for the untested sibling-path read: if the selector
    // ever mismatches the real form-state key, blockType comes back undefined
    // and styleGroupsFor(undefined) silently returns [] — no error, no failing
    // test, just a Style panel with zero controls.
    mockFlatFields = {
      'layout.0.id': { value: 'block-1' },
      'layout.0.blockType': { value: 'hero' },
    }
    render(<Field path="layout.0.blockStyle" />)

    // hero's styleGroupsFor includes all six groups. Heading and Eyebrow are
    // two of the three collapsible typography groups (Task 5) — their titles
    // now live inside a disclosure <button>, so they're queried by role.
    // Section isn't collapsible and keeps the plain legend-text query; it's
    // scoped to <legend> since the heading group's own `font` control has an
    // option also labelled "Heading" (see StyleControlGroups.test.tsx's
    // identical note).
    expect(screen.getByRole('button', { name: /Heading/ })).toBeTruthy()
    expect(screen.getByText('Section', { selector: 'legend' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Eyebrow/ })).toBeTruthy()
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0)
  })

  it('renders no control groups when blockType is absent, rather than throwing', () => {
    mockFlatFields = {
      'layout.0.id': { value: 'block-1' },
      // no 'layout.0.blockType' entry — the mismatch case this regression covers.
    }
    expect(() => render(<Field path="layout.0.blockStyle" />)).not.toThrow()

    expect(screen.queryByRole('button', { name: /Heading/ })).toBeNull()
    expect(screen.queryAllByRole('radio').length).toBe(0)
    expect(screen.queryAllByRole('switch').length).toBe(0)
  })

  it('writes a changed control into the blockStyles map keyed by the block id', () => {
    mockFlatFields = {
      'layout.0.id': { value: 'block-1' },
      'layout.0.blockType': { value: 'hero' },
    }
    render(<Field path="layout.0.blockStyle" />)

    // First control in presentation order is Section > Density, a segmented control.
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[0])

    expect(setValue).toHaveBeenCalledTimes(1)
    const next = setValue.mock.calls[0][0] as Record<string, unknown>
    // Keyed by the block's own id, not by blockType.
    expect(next['block-1']).toBeTruthy()
  })

  it('shows the "save this page" prompt and no controls when there is no block id yet', () => {
    mockFlatFields = {}
    render(<Field path="layout.0.blockStyle" />)

    expect(screen.getByText(/save this page once/i)).toBeTruthy()
    expect(screen.queryAllByRole('radio').length).toBe(0)
    expect(screen.queryAllByRole('switch').length).toBe(0)
  })
})
