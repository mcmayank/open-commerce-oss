'use client'

import React from 'react'
import Link from 'next/link'
import { formatAdminURL } from 'payload/shared'
import { useConfig } from '@payloadcms/ui'

/**
 * The builder's only way out — factored out of `BuilderTopBar` (final-review
 * Important 2) so the topbar's own link and the `pb-boot` boot/failure states
 * in `PageBuilderView` (which render BEFORE the topbar mounts, on a route with
 * no admin nav or header) cannot drift apart. Both derive the exact same
 * `formatAdminURL`-computed href off the same `useConfig()` call — see
 * `BuilderTopBar`'s docblock for why browser Back is not a substitute for this
 * link, and why the href is derived rather than hardcoded.
 */
export function BackToPagesLink({ className = 'pb-topbar__back' }: { className?: string }) {
  const {
    config: {
      routes: { admin: adminRoute },
    },
  } = useConfig()
  const pagesListURL = formatAdminURL({
    adminRoute,
    path: '/collections/pages',
    relative: true,
  })

  return (
    <Link className={className} href={pagesListURL}>
      <span aria-hidden="true">&larr;</span> Pages
    </Link>
  )
}
