import type { TenantOnboarding } from '@/lib/tenant-metrics'
import { SETUP_STEPS, countCompleteSteps } from '@/lib/dashboard/setup-steps'
import './hero.css'

/**
 * Five-segment progress strip under the hero. Purely derived from onboarding
 * flags on every render — nothing is persisted.
 *
 * The segment bars are decorative (`aria-hidden`); the completion summary is
 * carried by a visually-hidden node instead. Previously `role="img"` sat on
 * the container that also held the step titles, which prunes the whole
 * subtree from the accessibility tree — a screen-reader user heard only
 * "N of 5 steps complete" and never the step names. Titles are real content
 * here, exposed as a list, so they stay reachable.
 */
export function SetupRail({ onboarding }: { onboarding: TenantOnboarding }) {
  const done = countCompleteSteps(onboarding)
  const nextIndex = SETUP_STEPS.findIndex((s) => !onboarding[s.key])

  return (
    <>
      <span className="nb-rail__sr-only">
        {done} of {SETUP_STEPS.length} steps complete
      </span>
      <div className="nb-rail" role="list">
        {SETUP_STEPS.map((step, i) => {
          const isDone = onboarding[step.key]
          const isNow = i === nextIndex
          const segCls = isDone
            ? 'nb-rail__seg nb-rail__seg--done'
            : isNow
              ? 'nb-rail__seg nb-rail__seg--now'
              : 'nb-rail__seg'

          return (
            // aria-label mirrors the visible label: `listitem` does not derive
            // its accessible name from content, so without it the title would
            // be readable as text but not queryable/announced as the item's
            // name — exactly the kind of gap `role="img"` pruning caused.
            <div key={step.key} className="nb-rail__step" role="listitem" aria-label={step.title}>
              <span className={segCls} aria-hidden="true" />
              <span className={isNow ? 'nb-rail__label nb-rail__label--now' : 'nb-rail__label'}>
                {step.title}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}
