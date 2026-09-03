/**
 * Builds a starter `home` page layout for premium (Pro + default-theme)
 * tenants, pre-arranged from the Split Hero (Pro) block with the store name
 * dropped in. Used by scripts/apply-premium-home.ts.
 */
export function buildPremiumHomeLayout(store: {
  name: string
}): { blockType: string; [k: string]: unknown }[] {
  return [
    {
      blockType: 'splitHero',
      variant: 'mediaLeft',
      eyebrow: 'Welcome',
      heading: store.name,
      subheading: 'Tell your story here. Edit this section anytime from Pages in your admin.',
      primaryCtaLabel: 'Shop now',
      primaryCtaHref: '/products',
    },
  ]
}
