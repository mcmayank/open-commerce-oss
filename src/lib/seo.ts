import type { Metadata } from 'next'
import type { Media, Page, StoreSetting } from '@/payload-types'

/** Plain, origin-agnostic SEO input. Used by platform, docs, blog and (via the adapter below) storefront. */
export interface MetaInput {
  title: string
  description?: string
  /** Absolute URL of this page (canonical / og:url). */
  url: string
  /** Explicit canonical; defaults to `url`. */
  canonical?: string
  /** OG/Twitter image — absolute, or relative when a `metadataBase` is set. */
  image?: string
  /** og:site_name. */
  siteName?: string
  noindex?: boolean
  /** OpenGraph type; `article` also emits publishedTime/authors. */
  type?: 'website' | 'article'
  publishedTime?: string
  authors?: string[]
}

/** Turn plain SEO fields into a full Next.js `Metadata`, falling back to sensible defaults. */
export function buildMetadata(input: MetaInput): Metadata {
  const {
    title,
    description,
    url,
    canonical,
    image,
    siteName,
    noindex,
    type = 'website',
    publishedTime,
    authors,
  } = input
  const images = image ? [image] : undefined

  const openGraph: NonNullable<Metadata['openGraph']> = {
    title,
    description,
    url,
    type,
    siteName,
    ...(type === 'article' ? { publishedTime, authors } : {}),
  }
  const twitter: NonNullable<Metadata['twitter']> = {
    card: 'summary_large_image',
    title,
    description,
  }
  // Only set images when we have an explicit one. Leaving the key absent lets
  // Next merge a file-convention `opengraph-image` (with its hashed URL) instead
  // of an explicit `images: undefined` suppressing it.
  if (images) {
    openGraph.images = images
    twitter.images = images
  }

  return {
    title,
    description,
    alternates: { canonical: canonical || url },
    openGraph,
    twitter,
    robots: noindex ? { index: false, follow: false } : undefined,
  }
}

interface BuildPageMetadataArgs {
  page: Page
  settings: StoreSetting | null
  /** Absolute URL of this page (canonical / og:url). */
  url: string
  /** Title used when the page has no explicit meta title (e.g. page title, or store name for the home page). */
  fallbackTitle: string
}

/**
 * Adapter: map a Payload storefront `Page` into `buildMetadata`. Existing
 * storefront callers keep this exact signature and behaviour.
 */
export function buildPageMetadata({ page, settings, url, fallbackTitle }: BuildPageMetadataArgs): Metadata {
  return buildMetadata({
    title: page.meta?.title || fallbackTitle,
    description: page.meta?.description || settings?.description || undefined,
    url,
    canonical: page.meta?.canonicalUrl || url,
    image: resolveImageUrl(page.meta?.image),
    siteName: settings?.storeName ?? undefined,
    noindex: !!page.noindex,
  })
}

/** Resolve a populated media upload to its absolute URL (depth ≥ 1); null/id-only → undefined. */
function resolveImageUrl(image: number | Media | null | undefined): string | undefined {
  if (image && typeof image === 'object') return image.url ?? undefined
  return undefined
}
