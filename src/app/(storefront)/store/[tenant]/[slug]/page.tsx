import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import React from 'react'
import { cookies, draftMode } from 'next/headers'
import config from '@payload-config'
import { getPayload } from 'payload'
import { getStore, getStoreSettings, getPageBySlug, getDraftPageBySlug, storeBaseUrl } from '@/lib/storefront'
import { buildPageMetadata } from '@/lib/seo'
import { buildPageJsonLd } from '@/lib/structured-data'
import { resolveDraftState, PREVIEW_TENANT_COOKIE } from '@/lib/preview'
import { resolveActiveTheme } from '@/lib/preview-theme'
import { resolveThemeLayout } from '@/themes/layout'
import { RenderBlocks } from '@/blocks'
import { entitlementsOf } from '@/entitlements'
import { showsNiblrBranding } from '@/lib/branding'
import Header from '../components/Header'
import Footer from '../components/Footer'
import StoreTheme from '../components/StoreTheme'
import StoreCustomCss from '../components/StoreCustomCss'
import DraftBanner from '../components/DraftBanner'
import { PreviewBridge } from '../components/PreviewBridge'

interface Props {
  params: Promise<{ tenant: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant, slug } = await params
  const store = await getStore(tenant)
  if (!store) return {}
  const [settings, page] = await Promise.all([
    getStoreSettings(store.id),
    getPageBySlug(store.id, slug),
  ])
  if (!page) return {}
  return buildPageMetadata({
    page,
    settings,
    url: `${storeBaseUrl(store.slug)}/${slug}`,
    fallbackTitle: page.title,
  })
}

export default async function StorePage({ params }: Props) {
  const { tenant, slug } = await params

  const store = await getStore(tenant)
  if (!store) notFound()

  // Reading draftMode().isEnabled is cache-safe (during prerender it returns
  // false without bailing out). cookies() is a dynamic API, so resolveDraftState
  // only reads it on the preview path — keeping normal-visitor requests
  // statically cacheable instead of dynamically rendered on every hit.
  const { isEnabled: draftEnabled } = await draftMode()
  const isDraft = await resolveDraftState({
    draftEnabled,
    hostTenantId: store.id,
    readCookie: async () => (await cookies()).get(PREVIEW_TENANT_COOKIE)?.value,
  })

  const [settings, page] = await Promise.all([
    getStoreSettings(store.id),
    isDraft ? getDraftPageBySlug(store.id, slug) : getPageBySlug(store.id, slug),
  ])

  if (!page) notFound()

  const storeName = settings?.storeName ?? store.name
  const currency = settings?.currency ?? 'AED'
  const { premiumSections } = await entitlementsOf(store)

  const { theme } = await resolveActiveTheme(store)
  const layout = resolveThemeLayout(theme?.layout)

  // Skip structured data in draft/preview — it should reflect published content only.
  const jsonLd = isDraft
    ? null
    : buildPageJsonLd({ page, storeName, url: `${storeBaseUrl(store.slug)}/${slug}` })

  return (
    <div className="flex min-h-screen flex-col">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {isDraft && (
        <>
          <DraftBanner slug={slug} />
          <PreviewBridge />
        </>
      )}
      <StoreTheme settings={settings} preset={theme?.tokens} />
      <StoreCustomCss settings={settings} />
      <Header storeName={storeName} settings={settings} layout={layout.header} />

      <main className="flex-1">
        <RenderBlocks
          blocks={page.layout}
          ctx={{ tenantId: store.id, currency, premiumSections, payload: await getPayload({ config }) }}
          schemes={theme?.blockSchemes}
          blockStyles={page.blockStyles as Record<string, unknown> | undefined}
          styleDefaults={settings?.blockStyleDefaults as Record<string, unknown> | undefined}
        />
      </main>

      <Footer storeName={storeName} layout={layout.footer} showBranding={showsNiblrBranding(store)} />
    </div>
  )
}
