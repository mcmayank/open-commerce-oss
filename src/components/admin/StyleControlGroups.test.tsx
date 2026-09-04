/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { AllStyleGroups } from './StyleControlGroups'
import type { BlockStyle } from '@/lib/block-style/vocabulary'

afterEach(cleanup)

const noop = () => {}

describe('AllStyleGroups', () => {
  it('renders only the groups it is given', () => {
    render(
      <AllStyleGroups style={{}} groups={['heading', 'section']} scope="instance" onChange={noop} />,
    )
    // Heading is one of the three collapsible typography groups (Task 5) — its
    // title now lives inside a disclosure <button>, not as bare legend text, so
    // it's queried by role rather than by legend text content (matching the
    // "collapsible typography groups" describe block below). Section isn't
    // collapsible, so it keeps the plain legend-text query.
    expect(screen.getByRole('button', { name: /Heading/ })).toBeTruthy()
    expect(screen.getByText('Section', { selector: 'legend' })).toBeTruthy()
    expect(screen.queryByText('Eyebrow')).toBeNull()
    expect(screen.queryByText('Media')).toBeNull()
  })

  it('renders booleans as switches rather than dropdowns', () => {
    render(<AllStyleGroups style={{}} groups={['heading']} scope="instance" onChange={noop} />)
    const uppercase = screen.getByRole('switch', { name: /uppercase/i })
    expect(uppercase).toBeTruthy()
    expect(uppercase.getAttribute('aria-checked')).toBe('false')
  })

  it('toggling a switch writes an explicit on/off value, never clearing it', () => {
    // A switch click must never write `undefined` — `off` is a real, distinct
    // stored value (BLOCK_STYLE_VOCAB's `off` maps to an explicit CSS value,
    // not "unset"), so an instance can override an inherited `on` with an
    // explicit `off`. Clearing back to "inherit" is the Reset button's job.
    const onChange = vi.fn()
    const { rerender } = render(
      <AllStyleGroups style={{}} groups={['heading']} scope="instance" onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('switch', { name: /uppercase/i }))
    expect(onChange).toHaveBeenCalledWith('heading', 'uppercase', 'on')

    const set: BlockStyle = { heading: { uppercase: 'on' } }
    rerender(
      <AllStyleGroups style={set} groups={['heading']} scope="instance" onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('switch', { name: /uppercase/i }))
    expect(onChange).toHaveBeenLastCalledWith('heading', 'uppercase', 'off')
  })

  it('reflects a value inherited from the store layer, and can override it with an explicit off', () => {
    // Regression coverage: before this fix, the switch only ever reflected its
    // OWN (instance) value, so an instance with no override showed unchecked
    // even when the store layer had set the control to `on` — and clicking it
    // could only add a no-op `on` or clear back to the same inherited `on`,
    // with no way to actually turn it off for this one instance.
    const onChange = vi.fn()
    render(
      <AllStyleGroups
        style={{}}
        storeStyle={{ heading: { uppercase: 'on' } }}
        groups={['heading']}
        scope="instance"
        onChange={onChange}
      />,
    )
    const uppercase = screen.getByRole('switch', { name: /uppercase/i })
    expect(uppercase.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(uppercase)
    expect(onChange).toHaveBeenCalledWith('heading', 'uppercase', 'off')
  })

  it('names the inherited store value instead of saying "Default"', () => {
    render(
      <AllStyleGroups
        style={{}}
        storeStyle={{ heading: { font: 'display' } }}
        groups={['heading']}
        scope="instance"
        onChange={noop}
      />,
    )
    expect(screen.getByText('Store · Display')).toBeTruthy()
    expect(screen.queryByText('Default')).toBeNull()
  })

  it('offers a reset only for controls this instance overrides', () => {
    render(
      <AllStyleGroups
        style={{ heading: { size: '2xl' } }}
        groups={['heading']}
        scope="instance"
        onChange={noop}
      />,
    )
    expect(screen.getAllByRole('button', { name: /reset size/i })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /reset weight/i })).toBeNull()
  })

  it('shows no instance-origin labels in store scope, where there is no instance layer', () => {
    render(
      <AllStyleGroups
        style={{ heading: { size: '2xl' } }}
        groups={['heading']}
        scope="store"
        onChange={noop}
      />,
    )
    expect(screen.queryByText(/^Store · /)).toBeNull()
  })

  it('offers a reset for a switch under store scope once it is set, and the reset clears it', () => {
    // Regression coverage: `isOverridden` was computed from `origin`, which is
    // always `undefined` in store scope — so a switch's reset button never
    // rendered there. A switch click only ever writes an explicit 'on'/'off'
    // (never `undefined`), so without a reset a merchant who touched a
    // store-wide switch could never clear it back to "inherit" again.
    const onChange = vi.fn()
    const { rerender } = render(
      <AllStyleGroups style={{}} groups={['heading']} scope="store" onChange={onChange} />,
    )
    expect(screen.queryByRole('button', { name: /reset uppercase/i })).toBeNull()

    rerender(
      <AllStyleGroups
        style={{ heading: { uppercase: 'on' } }}
        groups={['heading']}
        scope="store"
        onChange={onChange}
      />,
    )
    const reset = screen.getByRole('button', { name: /reset uppercase/i })
    expect(reset).toBeTruthy()
    fireEvent.click(reset)
    expect(onChange).toHaveBeenCalledWith('heading', 'uppercase', undefined)
  })

  it('labels an unset control "Inherited" rather than "Theme" when no storeStyle prop is given at all', () => {
    // `BlockInspector`/`BlockStyleField` never pass `storeStyle` (documented,
    // deliberate — `blockStyleDefaults` lives on a different Payload document
    // than the page being edited). Before this fix, an unset control there
    // always rendered the literal word "Theme", which is confidently wrong
    // for a control the store HAS set — the merchant can see its value on the
    // canvas right beside the chip.
    render(<AllStyleGroups style={{}} groups={['media']} scope="instance" onChange={noop} />)
    expect(screen.getAllByText('Inherited').length).toBeGreaterThan(0)
    expect(screen.queryByText('Theme')).toBeNull()
  })

  it('keeps saying "Theme" for an unset control when the caller does pass a storeStyle prop', () => {
    render(
      <AllStyleGroups
        style={{}}
        storeStyle={{}}
        groups={['media']}
        scope="instance"
        onChange={noop}
      />,
    )
    expect(screen.getAllByText('Theme').length).toBeGreaterThan(0)
    expect(screen.queryByText('Inherited')).toBeNull()
  })
})

describe('collapsible typography groups', () => {
  it('opens Heading and collapses the other typography groups', () => {
    render(
      <AllStyleGroups
        style={{}}
        groups={['heading', 'eyebrow', 'subheading']}
        scope="instance"
        onChange={noop}
      />,
    )
    expect(screen.getByRole('button', { name: /Heading/ }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: /Eyebrow/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('summarises a collapsed group with its resolved style', () => {
    render(
      <AllStyleGroups
        style={{ eyebrow: { weight: '600' } }}
        storeStyle={{ eyebrow: { size: 'sm' } }}
        groups={['heading', 'eyebrow']}
        scope="instance"
        onChange={noop}
      />,
    )
    const summary = screen.getByTestId('nb-group-summary-eyebrow')
    expect(summary).toBeTruthy()
    expect(summary.textContent).toContain('Semibold')
    expect(summary.textContent).toContain('Small')
  })

  it('distinguishes a store-inherited value from an instance override in the collapsed summary', () => {
    // Regression coverage: weight is set on this instance, size is only
    // inherited from the store default. A summary that joins both labels with
    // no origin marker makes them indistinguishable — the same distinction the
    // expanded view draws via `originLabel()` ("Store · Display" vs bare) must
    // survive collapsing the group.
    render(
      <AllStyleGroups
        style={{ eyebrow: { weight: '600' } }}
        storeStyle={{ eyebrow: { size: 'sm' } }}
        groups={['heading', 'eyebrow']}
        scope="instance"
        onChange={noop}
      />,
    )
    const summary = screen.getByTestId('nb-group-summary-eyebrow')
    expect(summary).toBeTruthy()
    expect(summary.textContent).toContain('Store · Small')
    expect(summary.textContent).not.toContain('Store · Semibold')
  })

  it('badges a group with the number of instance overrides in it', () => {
    render(
      <AllStyleGroups
        style={{ heading: { size: '2xl', weight: '600' } }}
        groups={['heading']}
        scope="instance"
        onChange={noop}
      />,
    )
    expect(screen.getByTestId('nb-group-count-heading').textContent).toBe('2')
  })

  it('shows no badge for a group with no overrides', () => {
    render(<AllStyleGroups style={{}} groups={['heading']} scope="instance" onChange={noop} />)
    expect(screen.queryByTestId('nb-group-count-heading')).toBeNull()
  })

  it('expands a collapsed group when its header is clicked', () => {
    render(
      <AllStyleGroups style={{}} groups={['heading', 'eyebrow']} scope="instance" onChange={noop} />,
    )
    const header = screen.getByRole('button', { name: /Eyebrow/ })
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('promote to store-wide default', () => {
  it('offers promote-to-store-wide only in instance scope', () => {
    render(
      <AllStyleGroups
        style={{ heading: { size: 'xl' } }}
        groups={['heading']}
        scope="instance"
        blockType="hero"
        onChange={noop}
      />,
    )
    expect(screen.getByRole('button', { name: /use this style for all/i })).toBeTruthy()

    cleanup()
    render(
      <AllStyleGroups
        style={{ heading: { size: 'xl' } }}
        groups={['heading']}
        scope="store"
        blockType="hero"
        onChange={noop}
      />,
    )
    // In store scope this control IS the store-wide default — promoting is meaningless.
    expect(screen.queryByRole('button', { name: /use this style for all/i })).toBeNull()
  })

  it('names what it affects and does not write until confirmed', () => {
    const promote = vi.fn().mockResolvedValue(undefined)
    render(
      <AllStyleGroups
        style={{ heading: { size: 'xl' } }}
        groups={['heading']}
        scope="instance"
        blockType="hero"
        onChange={noop}
        promote={promote}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /use this style for all/i }))
    // The confirmation names the block type, per the spec's risk note that this
    // reaches outside the document being edited.
    expect(screen.getByRole('dialog').textContent).toMatch(/every hero/i)
    expect(promote).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Apply to all' }))
    expect(promote).toHaveBeenCalledWith('hero', { heading: { size: 'xl' } })
  })

  // Never pluralise a label this component doesn't own: 7 of the 20
  // STYLABLE_BLOCK_TYPES labels already end in "s", and the old `${label}s`
  // produced "Use for all Reviewss" (and "Heros" for the block every other test
  // here uses). Those tests match the invariant prefix by regex and so cannot
  // see the label at all — only asserting the WHOLE string, on a block whose
  // label already ends in "s", catches this.
  it('does not pluralise a block label that already ends in "s"', () => {
    render(
      <AllStyleGroups
        style={{ heading: { size: 'xl' } }}
        groups={['heading']}
        scope="instance"
        blockType="reviews"
        onChange={noop}
      />,
    )
    const trigger = screen.getByRole('button', { name: /use this style for all/i })
    expect(trigger.textContent).toBe('Use this style for all Reviews blocks')

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe(
      'Use this style for all Reviews blocks',
    )
    expect(screen.getByRole('dialog').textContent).toMatch(/every Reviews block\b/)
  })

  // Controller Ruling G (final review): clearing the instance overrides on
  // success made a successful promote look like a failure — the iframe is still
  // server-rendered from the OLD store defaults, so the live patch losing those
  // keys reverted the block on canvas, and BlockInspector passes no `storeStyle`
  // so every cleared control then read "Theme". The write is the whole effect.
  it('leaves the instance overrides in place on a successful promote', async () => {
    const onChange = vi.fn()
    const promote = vi.fn().mockResolvedValue(undefined)
    render(
      <AllStyleGroups
        style={{ heading: { size: 'xl', weight: '700' } }}
        groups={['heading']}
        scope="instance"
        blockType="hero"
        onChange={onChange}
        promote={promote}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /use this style for all/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply to all' }))
    await waitFor(() => expect(promote).toHaveBeenCalled())

    expect(onChange).not.toHaveBeenCalled()
  })

  it('confirms the write in words, since nothing on the canvas changes', async () => {
    const promote = vi.fn().mockResolvedValue(undefined)
    render(
      <AllStyleGroups
        style={{ heading: { size: 'xl' } }}
        groups={['heading']}
        scope="instance"
        blockType="hero"
        onChange={noop}
        promote={promote}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /use this style for all/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply to all' }))

    const status = await screen.findByRole('status')
    expect(status.textContent).toBe('Saved as the default for all Hero blocks.')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('holds the dialog open and blocks a second apply while the write is in flight', async () => {
    let settle: () => void = () => {}
    const promote = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve
        }),
    )
    render(
      <AllStyleGroups
        style={{ heading: { size: 'xl' } }}
        groups={['heading']}
        scope="instance"
        blockType="hero"
        onChange={noop}
        promote={promote}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /use this style for all/i }))
    const apply = screen.getByRole('button', { name: 'Apply to all' })
    fireEvent.click(apply)

    // No window with neither a dialog nor a result: the dialog is still up and
    // its apply button is inert until the promise settles.
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect((apply as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(apply)
    expect(promote).toHaveBeenCalledTimes(1)

    settle()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('leaves the instance untouched when the promote fails', async () => {
    const onChange = vi.fn()
    const promote = vi.fn().mockRejectedValue(new Error('403'))
    render(
      <AllStyleGroups
        style={{ heading: { size: 'xl' } }}
        groups={['heading']}
        scope="instance"
        blockType="hero"
        onChange={onChange}
        promote={promote}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /use this style for all/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply to all' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not/i))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('cancelling writes nothing', () => {
    const promote = vi.fn()
    render(
      <AllStyleGroups
        style={{ heading: { size: 'xl' } }}
        groups={['heading']}
        scope="instance"
        blockType="hero"
        onChange={noop}
        promote={promote}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /use this style for all/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(promote).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
