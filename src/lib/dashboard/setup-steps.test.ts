import { describe, expect, it } from 'vitest'
import type { TenantOnboarding } from '@/lib/tenant-metrics'
import { SETUP_STEPS, countCompleteSteps, firstIncompleteStep } from './setup-steps'

const onboarding = (over: Partial<TenantOnboarding> = {}): TenantOnboarding => ({
  hasProduct: false,
  hasGateway: false,
  hasStoreSettings: false,
  hasBranding: false,
  hasDomain: false,
  isLive: false,
  ...over,
})

describe('SETUP_STEPS', () => {
  it('lists the five steps in dependency order', () => {
    expect(SETUP_STEPS.map((s) => s.key)).toEqual([
      'hasProduct',
      'hasGateway',
      'hasStoreSettings',
      'hasBranding',
      'hasDomain',
    ])
  })

  it('never names a payment gateway that does not exist', () => {
    const copy = SETUP_STEPS.map((s) => `${s.title} ${s.desc}`).join(' ').toLowerCase()
    expect(copy).not.toContain('telr')
    expect(copy).not.toContain('tap')
  })
})

describe('firstIncompleteStep', () => {
  it('returns the first step when nothing is done', () => {
    expect(firstIncompleteStep(onboarding())?.key).toBe('hasProduct')
  })

  it('skips completed steps and returns the next gap', () => {
    const step = firstIncompleteStep(onboarding({ hasProduct: true }))
    expect(step?.key).toBe('hasGateway')
    expect(step?.key).not.toBe('hasProduct')
  })

  it('returns a later step when an early one is done but a middle one is not', () => {
    const step = firstIncompleteStep(
      onboarding({ hasProduct: true, hasGateway: true, hasBranding: true }),
    )
    expect(step?.key).toBe('hasStoreSettings')
  })

  it('returns null when every step is complete', () => {
    const all = onboarding({
      hasProduct: true,
      hasGateway: true,
      hasStoreSettings: true,
      hasBranding: true,
      hasDomain: true,
    })
    expect(firstIncompleteStep(all)).toBeNull()
  })
})

describe('countCompleteSteps', () => {
  it('counts only completed steps and ignores isLive', () => {
    expect(countCompleteSteps(onboarding())).toBe(0)
    expect(countCompleteSteps(onboarding({ isLive: true }))).toBe(0)
    expect(countCompleteSteps(onboarding({ hasProduct: true, hasDomain: true }))).toBe(2)
  })
})
