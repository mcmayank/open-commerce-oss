// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PremiumEntitlementClient, usePremiumEntitlement } from './PremiumEntitlementClient'

afterEach(() => {
  cleanup()
})

/** Reads all entitlement flags from context and renders them for assertion. */
const Probe = () => {
  const { premiumSections, customCss, customSections } = usePremiumEntitlement()
  return (
    <div>
      <span data-testid="premiumSections">{String(premiumSections)}</span>
      <span data-testid="customCss">{String(customCss)}</span>
      <span data-testid="customSections">{String(customSections)}</span>
    </div>
  )
}

describe('PremiumEntitlementClient', () => {
  it('fails closed (all flags false) when read with no provider', () => {
    render(<Probe />)
    expect(screen.getByTestId('premiumSections').textContent).toBe('false')
    expect(screen.getByTestId('customCss').textContent).toBe('false')
    expect(screen.getByTestId('customSections').textContent).toBe('false')
  })

  it('carries all entitlements as independent flags when all are entitled', () => {
    render(
      <PremiumEntitlementClient premiumSections={true} customCss={true} customSections={true}>
        <Probe />
      </PremiumEntitlementClient>,
    )
    expect(screen.getByTestId('premiumSections').textContent).toBe('true')
    expect(screen.getByTestId('customCss').textContent).toBe('true')
    expect(screen.getByTestId('customSections').textContent).toBe('true')
  })

  it('carries all entitlements as independent flags when all are denied', () => {
    render(
      <PremiumEntitlementClient premiumSections={false} customCss={false} customSections={false}>
        <Probe />
      </PremiumEntitlementClient>,
    )
    expect(screen.getByTestId('premiumSections').textContent).toBe('false')
    expect(screen.getByTestId('customCss').textContent).toBe('false')
    expect(screen.getByTestId('customSections').textContent).toBe('false')
  })

  it('does not conflate the flags when they diverge', () => {
    render(
      <PremiumEntitlementClient premiumSections={true} customCss={false} customSections={true}>
        <Probe />
      </PremiumEntitlementClient>,
    )
    expect(screen.getByTestId('premiumSections').textContent).toBe('true')
    expect(screen.getByTestId('customCss').textContent).toBe('false')
    expect(screen.getByTestId('customSections').textContent).toBe('true')

    cleanup()

    render(
      <PremiumEntitlementClient premiumSections={false} customCss={true} customSections={false}>
        <Probe />
      </PremiumEntitlementClient>,
    )
    expect(screen.getByTestId('premiumSections').textContent).toBe('false')
    expect(screen.getByTestId('customCss').textContent).toBe('true')
    expect(screen.getByTestId('customSections').textContent).toBe('false')
  })
})
