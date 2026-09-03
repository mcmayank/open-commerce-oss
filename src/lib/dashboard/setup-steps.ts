import type { TenantOnboarding } from '@/lib/tenant-metrics'

export type SetupStepKey = Exclude<keyof TenantOnboarding, 'isLive'>

export type SetupStep = {
  key: SetupStepKey
  title: string
  /** One line on why this step matters — end-user framing, active voice. */
  desc: string
  href: string
  cta: string
  /**
   * Optional extra actions beside the primary CTA. Known values, not
   * components, so this module stays plain data importable from server
   * components.
   */
  secondary?: ('seedSamples' | 'importStore')[]
}

/**
 * Ordered setup steps. Each maps to a derived flag from `deriveOnboarding`
 * (src/lib/tenant-metrics.ts) and links to the exact screen that completes it.
 *
 * Copy is brand-checked: only gateways that exist in src/payments/providers/
 * may be named. Tap and Telr do not exist — see the brand principles doc.
 *
 * NOTE: branding + domain point at their native collection forms for now.
 * When the Store branding view (W2) and Domains view (W4) land, repoint
 * `hasBranding` → /admin/settings/branding and `hasDomain` → /admin/settings/domains.
 */
export const SETUP_STEPS: SetupStep[] = [
  {
    key: 'hasProduct',
    title: 'Add your first product',
    desc: 'Your store needs something to sell before it can take orders.',
    href: '/admin/collections/products/create',
    cta: 'Add product',
    // Three ways to fill a catalog, in ascending order of how much the
    // merchant already has: type one in, seed samples, or bring an existing
    // store across.
    secondary: ['seedSamples', 'importStore'],
  },
  {
    key: 'hasGateway',
    title: 'Connect a payment gateway',
    desc: 'Let customers pay you — connect Stripe, Razorpay, and more.',
    href: '/admin/settings/payments',
    cta: 'Connect payments',
  },
  {
    key: 'hasStoreSettings',
    title: 'Name your store and set its currency',
    desc: 'Set how your store is titled and how prices are shown.',
    href: '/admin/collections/store-settings',
    cta: 'Open settings',
  },
  {
    key: 'hasBranding',
    title: 'Add your logo',
    desc: 'Put your mark on your storefront and checkout.',
    href: '/admin/collections/store-settings',
    cta: 'Add branding',
  },
  {
    key: 'hasDomain',
    title: 'Connect a custom domain',
    desc: 'Go live on your own web address instead of a subdomain.',
    href: '/admin/collections/domains',
    cta: 'Add domain',
  },
]

/** The first step the merchant has not finished, or null when all are done. */
export function firstIncompleteStep(onboarding: TenantOnboarding): SetupStep | null {
  return SETUP_STEPS.find((s) => !onboarding[s.key]) ?? null
}

/** How many of SETUP_STEPS are complete. `isLive` is not a step and is ignored. */
export function countCompleteSteps(onboarding: TenantOnboarding): number {
  return SETUP_STEPS.filter((s) => onboarding[s.key]).length
}
