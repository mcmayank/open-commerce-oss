/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, within } from '@testing-library/react'
import BlockStyleDefaultsField from './BlockStyleDefaultsField'
import { STYLABLE_BLOCK_TYPES } from '@/lib/block-style/panel'

const setValue = vi.fn()
let mockValue: Record<string, unknown> = {}

vi.mock('@payloadcms/ui', () => ({
  useField: () => ({ value: mockValue, setValue }),
}))

afterEach(() => {
  cleanup()
  setValue.mockReset()
  mockValue = {}
})

/** The component takes Payload's UI-field props, none of which it reads. */
const Panel = BlockStyleDefaultsField as unknown as React.ComponentType

/**
 * Open a panel the way a browser does: the summary click flips `open`
 * natively, and the `toggle` event follows as a separate task (jsdom, like the
 * spec, does not fire it synchronously). React's onToggle listens for that
 * second step, so a test that only clicks never mounts the contents.
 */
function openPanel(details: HTMLDetailsElement, label: string) {
  fireEvent.click(within(details).getByText(label))
  fireEvent(details, new Event('toggle', { bubbles: false }))
}

describe('BlockStyleDefaultsField', () => {
  it('renders one collapsed panel per stylable block type', () => {
    const { container } = render(<Panel />)
    const panels = container.querySelectorAll('details')

    expect(panels.length).toBe(STYLABLE_BLOCK_TYPES.length)
    for (const p of panels) expect((p as HTMLDetailsElement).open).toBe(false)
  })

  it('expands a panel when its summary is clicked', () => {
    // The reported bug: clicking the title row does not open the panel.
    const { container } = render(<Panel />)
    const hero = container.querySelector('details')! as HTMLDetailsElement

    fireEvent.click(within(hero).getByText('Hero'))

    expect(hero.open).toBe(true)
  })

  it('exposes the vocabulary controls once a panel is open', () => {
    const { container } = render(<Panel />)
    const hero = container.querySelector('details')! as HTMLDetailsElement

    openPanel(hero, 'Hero')

    // Heading is one of the three collapsible typography groups (Task 5) — its
    // title now lives inside a disclosure <button>, not bare legend text.
    expect(within(hero).getByRole('button', { name: /Heading/ })).toBeTruthy()
    // Controls are now switches/segmented buttons rather than <select>s (Task 4).
    const widgets = [...within(hero).queryAllByRole('radio'), ...within(hero).queryAllByRole('switch')]
    expect(widgets.length).toBeGreaterThan(0)
  })

  it('writes a changed control into the map keyed by blockType', () => {
    const { container } = render(<Panel />)
    const hero = container.querySelector('details')! as HTMLDetailsElement
    openPanel(hero, 'Hero')

    // First control in presentation order is Section > Density, a segmented control.
    const radios = within(hero).getAllByRole('radio')
    fireEvent.click(radios[0])

    expect(setValue).toHaveBeenCalledTimes(1)
    const next = setValue.mock.calls[0][0] as Record<string, unknown>
    // Keyed by blockType ('hero'), not by a per-row block id.
    expect(next.hero).toBeTruthy()
  })

  it('gives every panel a distinct label, so no two rows look the same', () => {
    const { container } = render(<Panel />)
    const labels = Array.from(container.querySelectorAll('summary')).map((s) => s.textContent)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('BlockStyleDefaultsField — closed panels stay cheap', () => {
  it('mounts no controls for panels that are closed', () => {
    // <details> hides children with CSS but still mounts them, so rendering
    // every panel's controls eagerly put 560 controls in the document before
    // the merchant touched anything (560 <select>s and ~2,500 <option>s, back
    // when controls were selects). Inside Payload's form context, which
    // re-renders on form-state changes, that is what made the tab feel
    // unresponsive — a summary click appearing to do nothing.
    const { container } = render(<Panel />)

    expect(container.querySelectorAll('details').length).toBe(STYLABLE_BLOCK_TYPES.length)
    expect(container.querySelectorAll('[role="radio"], [role="switch"]').length).toBe(0)
  })

  it('mounts only the opened panel\'s controls, not every panel\'s', () => {
    const { container } = render(<Panel />)
    const hero = container.querySelector('details')! as HTMLDetailsElement

    openPanel(hero, 'Hero')

    const total = container.querySelectorAll('[role="radio"], [role="switch"]').length
    expect(total).toBeGreaterThan(0)
    const inHero = within(hero).queryAllByRole('radio').length + within(hero).queryAllByRole('switch').length
    expect(inHero).toBe(total)
  })
})

