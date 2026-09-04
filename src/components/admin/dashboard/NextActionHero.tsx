import type { NextAction } from '@/lib/dashboard/next-action'
import type { TenantOnboarding } from '@/lib/tenant-metrics'
import { Button } from '@/components/admin/brand/ui'
import { SeedSampleProductsButton } from './SeedSampleProductsButton'
import { SetupRail } from './SetupRail'
import './hero.css'

/**
 * The one band that tells the merchant what to do next.
 *
 * Deliberately dumb: every decision — which message, which CTA, whether the
 * rail shows — is made by `resolveNextAction` and arrives as data. Keeping the
 * branching out of here is what makes the behaviour testable without rendering.
 */
export function NextActionHero({
  action,
  onboarding,
}: {
  action: NextAction
  onboarding: TenantOnboarding
}) {
  return (
    <section className="nb-hero" aria-labelledby="nb-hero-title">
      <p className="nb-hero__eyebrow">{action.eyebrow}</p>
      <h2 className="nb-hero__title" id="nb-hero-title">
        {action.title}
      </h2>
      <p className="nb-hero__body">{action.body}</p>

      <div className="nb-hero__actions">
        <Button
          href={action.ctaHref}
          variant="primary"
          target={action.ctaTarget}
          rel={action.ctaTarget === '_blank' ? 'noreferrer' : undefined}
        >
          {action.ctaLabel}
        </Button>
        {action.secondaryLabel && action.secondaryHref && (
          <Button href={action.secondaryHref} variant="ghost">
            {action.secondaryLabel}
          </Button>
        )}
        {action.showSeedSamples && <SeedSampleProductsButton />}
        {action.showImportStore && (
          // The import form lives further down this same dashboard, so this
          // moves the merchant to it rather than opening a second screen.
          <Button href="#import-store" variant="ghost">
            Import from an existing store
          </Button>
        )}
      </div>

      {action.showSetupRail && <SetupRail onboarding={onboarding} />}
    </section>
  )
}
