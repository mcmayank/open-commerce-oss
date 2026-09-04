// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { TenantOnboarding } from '@/lib/tenant-metrics'
import { SETUP_STEPS } from '@/lib/dashboard/setup-steps'
import { SetupRail } from './SetupRail'

// RTL only auto-cleans when Vitest globals are on; this repo imports its test
// helpers explicitly, so unmount by hand or renders stack up.
afterEach(cleanup)

const onboarding = (over: Partial<TenantOnboarding> = {}): TenantOnboarding => ({
  hasProduct: false,
  hasGateway: false,
  hasStoreSettings: false,
  hasBranding: false,
  hasDomain: false,
  isLive: false,
  ...over,
})

describe('SetupRail', () => {
  it('renders one segment per setup step', () => {
    const { container } = render(<SetupRail onboarding={onboarding()} />)
    // Comparative against the registry (not a hardcoded 5) so this tracks
    // SETUP_STEPS instead of silently going stale if a step is added.
    expect(container.querySelectorAll('.nb-rail__seg')).toHaveLength(SETUP_STEPS.length)
  })

  it('marks completed steps done and the first gap as current', () => {
    const { container } = render(<SetupRail onboarding={onboarding({ hasProduct: true })} />)
    const segs = Array.from(container.querySelectorAll('.nb-rail__seg'))

    expect(segs[0].className).toContain('nb-rail__seg--done')
    expect(segs[0].className).not.toContain('nb-rail__seg--now')

    expect(segs[1].className).toContain('nb-rail__seg--now')
    expect(segs[1].className).not.toContain('nb-rail__seg--done')

    expect(segs[2].className).not.toContain('nb-rail__seg--done')
    expect(segs[2].className).not.toContain('nb-rail__seg--now')
  })

  it('marks no segment current when every step is done', () => {
    const { container } = render(
      <SetupRail
        onboarding={onboarding({
          hasProduct: true,
          hasGateway: true,
          hasStoreSettings: true,
          hasBranding: true,
          hasDomain: true,
        })}
      />,
    )
    expect(container.querySelectorAll('.nb-rail__seg--done')).toHaveLength(5)
    expect(container.querySelectorAll('.nb-rail__seg--now')).toHaveLength(0)
  })

  it('exposes the completion summary to assistive technology, tracking the input rather than a constant', () => {
    const first = render(
      <SetupRail onboarding={onboarding({ hasProduct: true, hasGateway: true })} />,
    )
    expect(screen.getByText('2 of 5 steps complete')).toBeTruthy()
    first.unmount()

    render(
      <SetupRail
        onboarding={onboarding({ hasProduct: true, hasGateway: true, hasStoreSettings: true })}
      />,
    )
    expect(screen.getByText('3 of 5 steps complete')).toBeTruthy()
    expect(screen.queryByText('2 of 5 steps complete')).toBeNull()
  })

  it('keeps step titles reachable in the accessibility tree instead of pruning them under a decorative role', () => {
    // Regression guard: role="img" used to sit on the container that also
    // held these titles, which prunes the whole subtree from the AT tree —
    // a screen reader heard only the completion summary, never step names.
    // An accessible-name query (not container.querySelector) is the only way
    // to catch that, since querySelector doesn't know about ARIA pruning.
    render(<SetupRail onboarding={onboarding()} />)
    expect(screen.getByRole('listitem', { name: 'Add your first product' })).toBeTruthy()
    expect(screen.queryByRole('listitem', { name: 'Not a real step' })).toBeNull()
  })
})
