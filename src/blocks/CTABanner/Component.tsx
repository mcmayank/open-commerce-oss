import React from 'react'
import Link from 'next/link'
import type { CTABannerBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { safeHref } from '@/lib/safe-href'

interface CTABannerComponentProps {
  block: CTABannerBlock
  ctx: BlockContext
}

/**
 * CTABanner block — server component.
 * Full-width band using --color-primary (fallback: gray-900).
 */
export function CTABannerComponent({ block }: CTABannerComponentProps) {
  const { heading, body, buttonLabel, buttonHref } = block
  const href = safeHref(buttonHref)

  return (
    <section className="w-full py-[var(--bs-section-pad,4rem)] px-4 sm:px-6 lg:px-8 text-center">
      <div className="mx-auto max-w-[var(--bs-section-width,48rem)]">
        <h2
          data-nb-part="heading"
          className="text-[length:var(--bs-heading-size,1.875rem)] sm:text-[length:var(--bs-heading-size,2.25rem)] font-[weight:var(--bs-heading-weight,800)] tracking-[var(--bs-heading-tracking,-0.025em)] [font-family:var(--bs-heading-font,inherit)] [font-style:var(--bs-heading-style,normal)] [text-transform:var(--bs-heading-transform,none)] text-(--section-heading)"
        >
          {heading}
        </h2>
        {body && (
          <p
            data-nb-part="body"
            className="mt-4 text-[length:var(--bs-subheading-size,1.125rem)] font-[weight:var(--bs-subheading-weight,400)] tracking-[var(--bs-subheading-tracking,0em)] [font-family:var(--bs-subheading-font,inherit)] [font-style:var(--bs-subheading-style,normal)] [text-transform:var(--bs-subheading-transform,none)] text-(--section-muted) leading-relaxed"
          >
            {body}
          </p>
        )}
        {buttonLabel && href && (
          <div className="mt-8">
            <Link
              href={href}
              data-nb-part="cta"
              className="inline-block rounded-(--radius-button) bg-(--color-surface) px-8 py-3 text-sm font-semibold text-(--color-primary) transition-opacity hover:opacity-90"
            >
              {buttonLabel}
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
