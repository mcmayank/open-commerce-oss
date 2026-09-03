// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { NextAction } from '@/lib/dashboard/next-action'
import type { TenantOnboarding } from '@/lib/tenant-metrics'
import { NextActionHero } from './NextActionHero'

// SeedSampleProductsButton is a client component that talks to the seed API;
// stub it so this test stays a pure render assertion.
vi.mock('./SeedSampleProductsButton', () => ({
  SeedSampleProductsButton: () => <button type="button">Start with sample products</button>,
}))

afterEach(cleanup)

const onboarding: TenantOnboarding = {
  hasProduct: false,
  hasGateway: false,
  hasStoreSettings: false,
  hasBranding: false,
  hasDomain: false,
  isLive: false,
}

const action = (over: Partial<NextAction> = {}): NextAction => ({
  key: 'fulfil',
  eyebrow: 'Needs your attention',
  title: '3 orders are waiting to be fulfilled',
  body: 'These customers have paid and are waiting.',
  ctaLabel: 'View orders to fulfil',
  ctaHref: '/admin/collections/orders?where[status][equals]=paid',
  showSeedSamples: false,
  showImportStore: false,
  showSetupRail: false,
  ...over,
})

describe('NextActionHero', () => {
  it('renders the eyebrow, title and body it is given', () => {
    render(<NextActionHero action={action()} onboarding={onboarding} />)
    expect(screen.getByText('Needs your attention')).toBeTruthy()
    expect(screen.getByText('3 orders are waiting to be fulfilled')).toBeTruthy()
    expect(screen.queryByText('Get your first sale')).toBeNull()
  })

  it('renders the primary CTA pointing at the given href', () => {
    render(<NextActionHero action={action()} onboarding={onboarding} />)
    const cta = screen.getByRole('link', { name: 'View orders to fulfil' })
    expect(cta.getAttribute('href')).toBe('/admin/collections/orders?where[status][equals]=paid')
  })

  it('renders a secondary CTA only when one is supplied', () => {
    const { unmount } = render(<NextActionHero action={action()} onboarding={onboarding} />)
    expect(screen.queryByRole('link', { name: 'Add another product' })).toBeNull()
    unmount()

    render(
      <NextActionHero
        action={action({ secondaryLabel: 'Add another product', secondaryHref: '/x' })}
        onboarding={onboarding}
      />,
    )
    expect(screen.getByRole('link', { name: 'Add another product' }).getAttribute('href')).toBe('/x')
  })

  it('shows the setup rail only when the action asks for it', () => {
    const { container, unmount } = render(
      <NextActionHero action={action()} onboarding={onboarding} />,
    )
    expect(container.querySelector('.nb-rail')).toBeNull()
    unmount()

    const withRail = render(
      <NextActionHero action={action({ showSetupRail: true })} onboarding={onboarding} />,
    )
    expect(withRail.container.querySelector('.nb-rail')).toBeTruthy()
  })

  it('shows the sample-seed button only when the action asks for it', () => {
    const { unmount } = render(<NextActionHero action={action()} onboarding={onboarding} />)
    expect(screen.queryByText('Start with sample products')).toBeNull()
    unmount()

    render(
      <NextActionHero action={action({ showSeedSamples: true })} onboarding={onboarding} />,
    )
    expect(screen.getByText('Start with sample products')).toBeTruthy()
  })

  it('links to the on-page import card only when the action asks for it', () => {
    const { unmount } = render(<NextActionHero action={action()} onboarding={onboarding} />)
    expect(screen.queryByRole('link', { name: 'Import from an existing store' })).toBeNull()
    unmount()

    render(<NextActionHero action={action({ showImportStore: true })} onboarding={onboarding} />)
    const link = screen.getByRole('link', { name: 'Import from an existing store' })
    expect(link.getAttribute('href')).toBe('#import-store')
  })

  it('opens the primary CTA in a new tab only when the action sets ctaTarget', () => {
    const { unmount } = render(<NextActionHero action={action()} onboarding={onboarding} />)
    const sameTabCta = screen.getByRole('link', { name: 'View orders to fulfil' })
    expect(sameTabCta.getAttribute('target')).toBeNull()
    expect(sameTabCta.getAttribute('rel')).toBeNull()
    unmount()

    render(
      <NextActionHero
        action={action({
          ctaLabel: 'View your live store',
          ctaHref: '/',
          ctaTarget: '_blank',
        })}
        onboarding={onboarding}
      />,
    )
    const newTabCta = screen.getByRole('link', { name: 'View your live store' })
    expect(newTabCta.getAttribute('target')).toBe('_blank')
    expect(newTabCta.getAttribute('rel')).toBe('noreferrer')
  })
})
