/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SelectionOverlay } from './SelectionOverlay'

afterEach(cleanup)

const RECTS = [
  { blockId: 'a', top: 0, left: 0, width: 1280, height: 500 },
  { blockId: 'b', top: 500, left: 0, width: 1280, height: 300 },
]

const noop = () => {}

describe('SelectionOverlay', () => {
  it('positions the selection box in scaled coordinates', () => {
    render(
      <SelectionOverlay
        rects={RECTS}
        scale={0.625}
        selectedId="b"
        hoveredId={null}
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    const box = screen.getByTestId('nb-selection-box')
    expect(box).toBeTruthy()
    expect(box.style.top).toBe(`${500 * 0.625}px`)
    expect(box.style.height).toBe(`${300 * 0.625}px`)
  })

  it('renders nothing for a selection the frame has not reported yet', () => {
    render(
      <SelectionOverlay
        rects={RECTS}
        scale={1}
        selectedId="missing"
        hoveredId={null}
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    expect(screen.queryByTestId('nb-selection-box')).toBeNull()
  })

  it('calls the reorder handler rather than posting a bridge message', () => {
    const onMove = vi.fn()
    render(
      <SelectionOverlay
        rects={RECTS}
        scale={1}
        selectedId="a"
        hoveredId={null}
        onMove={onMove}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Move block down' }))
    expect(onMove).toHaveBeenCalledWith('down')
  })

  it('draws a hover outline that is distinct from the selection box', () => {
    render(
      <SelectionOverlay
        rects={RECTS}
        scale={1}
        selectedId="a"
        hoveredId="b"
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    expect(screen.getByTestId('nb-selection-box')).toBeTruthy()
    expect(screen.getByTestId('nb-hover-box')).toBeTruthy()
  })

  it('suppresses the hover outline when hover and selection are the same block', () => {
    render(
      <SelectionOverlay
        rects={RECTS}
        scale={1}
        selectedId="a"
        hoveredId="a"
        onMove={noop}
        onDuplicate={noop}
        onDelete={noop}
      />,
    )
    expect(screen.queryByTestId('nb-hover-box')).toBeNull()
  })
})
