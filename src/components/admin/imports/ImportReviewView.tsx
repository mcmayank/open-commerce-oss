import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { headers } from 'next/headers'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { storeForHost } from '@/store-loader'
import { isSuperAdmin, ownsTenant, type TenantsArrayUser } from '@/access/roles'
import { entitlementsById } from '@/entitlements'
import type { ImportItem, ImportJob } from '@/payload-types'
import { ImportReviewClient, type ReviewItemVM } from './ImportReviewClient'
import { storeWhere, storeIdOf } from '@/store-scope'

/**
 * Review — phase two of three (`docs/PRODUCT-IMPORT.md` Task 7).
 *
 * Zero network calls to the merchant's old store: everything shown here was
 * fetched once during discovery and stored on the item. Image thumbnails point
 * at the SOURCE CDN, not at our bucket, because nothing is downloaded until the
 * merchant presses import.
 *
 * Registered at `/imports/:id`; the id comes from the URL segments.
 */
export async function ImportReviewView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { payload, user, i18n } = req

  const template = (children: React.ReactNode) => (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <div style={{ padding: '2rem', maxWidth: '1100px' }}>{children}</div>
    </DefaultTemplate>
  )

  const store = await storeForHost(await headers())
  if (!store) {
    return template(
      <>
        <h1>Import</h1>
        <p>Open your store&apos;s admin from its own domain to review an import.</p>
      </>,
    )
  }

  const typedUser = user as TenantsArrayUser | null
  if (!typedUser || (!isSuperAdmin(typedUser) && !ownsTenant(typedUser, store.id))) {
    return template(
      <>
        <h1>Not authorized</h1>
        <p>You don&apos;t have permission to review this store&apos;s imports.</p>
      </>,
    )
  }

  const segments = (await params)?.segments ?? []
  const jobId = Number(segments[segments.length - 1])
  if (!Number.isInteger(jobId)) {
    return template(
      <>
        <h1>Import</h1>
        <p>That import link is not valid.</p>
      </>,
    )
  }

  const job = (await payload
    .findByID({ collection: 'import-jobs', id: jobId, overrideAccess: true })
    .catch(() => null)) as ImportJob | null

  // Belt and braces: the tenant is already host-bound above, but a job id is
  // guessable and this view runs with overrideAccess.
  const jobTenantId = storeIdOf(job)
  if (!job || jobTenantId !== store.id) {
    return template(
      <>
        <h1>Import</h1>
        <p>That import was not found for this store.</p>
      </>,
    )
  }

  const { docs } = await payload.find({
    collection: 'import-items',
    where: { job: { equals: jobId } },
    limit: 1000,
    sort: 'id',
    overrideAccess: true,
  })

  const items: ReviewItemVM[] = (docs as ImportItem[]).map((doc) => {
    const mapped = (doc.mapped ?? {}) as {
      title?: string
      images?: { url?: string }[]
      variants?: { priceMinor?: number }[]
    }
    const variants = mapped.variants ?? []
    return {
      id: doc.id,
      title: mapped.title ?? '(untitled)',
      thumbnailUrl: mapped.images?.[0]?.url ?? null,
      variantCount: variants.length,
      priceMinor: typeof variants[0]?.priceMinor === 'number' ? variants[0].priceMinor : null,
      warnings: (doc.warnings ?? []) as ReviewItemVM['warnings'],
      status: doc.status as ReviewItemVM['status'],
      // Only failed items keep an error worth showing. A completed job has
      // pruned its imported and skipped items, so what remains here is exactly
      // the failure list the summary renders.
      error: typeof doc.error === 'string' ? doc.error : null,
    }
  })

  const { maxProducts } = await entitlementsById(payload, store.id)
  const { totalDocs: existingProductCount } = await payload.count({
    collection: 'products',
    where: storeWhere(store.id),
    overrideAccess: true,
  })

  return template(
    <ImportReviewClient
      jobId={jobId}
      sourceUrl={job.sourceUrl}
      sourceLabel={job.sourceId ?? 'source'}
      storeCurrency={job.sourceCurrency ?? ''}
      initialItems={items}
      initialTaxTreatment={(job.priceTaxTreatment ?? null) as 'inclusive' | 'exclusive' | null}
      initialOwnershipAttested={Boolean(job.ownershipAttestedAt)}
      maxProducts={maxProducts}
      existingProductCount={existingProductCount}
      // Status and counts so reopening a running import resumes the progress
      // view and keeps pumping, rather than showing the grid again.
      initialStatus={job.status as 'ready' | 'importing' | 'completed' | 'failed'}
      initialImported={job.importedCount ?? 0}
      initialFailed={job.failedCount ?? 0}
      selectedCount={job.selectedCount ?? 0}
      jobError={job.error ?? null}
    />,
  )
}
