import React from 'react'
import type { NewsletterSignupBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { HEADING_2XL as HEADING_TYPE } from '@/blocks/shared/vocab-classes'

interface NewsletterSignupComponentProps {
  block: NewsletterSignupBlock
  ctx: BlockContext
}

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only. See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals NewsletterSignup's pre-existing literal default, so an
// unstyled NewsletterSignup renders pixel-identical to before this system
// existed. There is no `data-nb-part="body"` in this block (heading + CTA
// only), so only heading and section are wired. HEADING_TYPE (text-2xl ->
// sm:3xl, bold, tight) is shared byte-for-byte across blocks — see
// src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

/**
 * NewsletterSignup block — server component.
 * Plain HTML form POSTing email to /api/newsletter.
 * No client JS required for v1.
 */
export function NewsletterSignupComponent({ block }: NewsletterSignupComponentProps) {
  const { heading, placeholder } = block

  return (
    <section className="py-[var(--bs-section-pad,3.5rem)] px-4 sm:px-6 lg:px-8 bg-[var(--color-surface,#f9fafb)]">
      <div className="mx-auto max-w-[var(--bs-section-width,36rem)] text-center">
        {heading && (
          <h2 data-nb-part="heading" className={`mb-4 ${HEADING_TYPE} text-(--section-heading)`}>
            {heading}
          </h2>
        )}
        <form
          method="post"
          action="/api/newsletter"
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-2"
        >
          <input
            type="email"
            name="email"
            required
            placeholder={placeholder ?? 'Enter your email address'}
            className="flex-1 rounded-[var(--radius-button,0.5rem)] border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-[var(--color-primary,#111827)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#111827)]"
            aria-label="Email address"
          />
          <button
            type="submit"
            data-nb-part="cta"
            className="rounded-[var(--radius-button,0.5rem)] bg-[var(--color-primary,#111827)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#111827)] focus:ring-offset-2"
          >
            Subscribe
          </button>
        </form>
      </div>
    </section>
  )
}
