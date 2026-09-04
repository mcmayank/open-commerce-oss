/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SelectionProvider, useSelection } from './selection'

afterEach(cleanup)

function Probe() {
  const { selectedId, select } = useSelection()
  return <button onClick={() => select('blk_x')}>{selectedId ?? 'none'}</button>
}

describe('selection', () => {
  it('shares selected id through the provider', () => {
    render(
      <SelectionProvider>
        <Probe />
      </SelectionProvider>,
    )
    expect(screen.getByRole('button').textContent).toBe('none')
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').textContent).toBe('blk_x')
  })

  it('throws when used outside the provider', () => {
    // Suppress the expected React error-boundary console.error noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/useSelection must be used within a SelectionProvider/)
    spy.mockRestore()
  })
})
