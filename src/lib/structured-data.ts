import type { Page } from '@/payload-types'
import { fromMinor } from '@/lib/money'
import { isInStock } from '@/lib/inventory'
import { REPO_IS_PUBLIC, REPO_URL } from '@/lib/repo'

/** A single schema.org JSON-LD node. */
type JsonLdNode = Record<string, unknown>

interface BuildPageJsonLdArgs {
  page: Page
  storeName: string
  /** Absolute URL of this page, used for the primary node's `url`. */
  url: string
}

/**
 * Build schema.org JSON-LD for a storefront page.
 *
 * Emits a primary node (WebPage or Article, per `aeo.schemaType`) plus a
 * FAQPage node synthesised from any FAQ blocks in the page layout — the same
 * questions the visitor sees, made machine-readable for AI answer engines.
 * Returns `null` when there is nothing worth emitting.
 */
export function buildPageJsonLd({ page, storeName, url }: BuildPageJsonLdArgs): JsonLdNode[] | null {
  const nodes: JsonLdNode[] = []

  const description = page.aeo?.answerSummary ?? page.meta?.description ?? undefined
  const name = page.meta?.title ?? page.title

  const primary: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': page.aeo?.schemaType ?? 'WebPage',
    name,
    url,
    isPartOf: { '@type': 'WebSite', name: storeName },
  }
  if (description) primary.description = description
  nodes.push(primary)

  const faq = buildFaqNode(page.layout)
  if (faq) nodes.push(faq)

  return nodes.length > 0 ? nodes : null
}

/** Map every FAQ block's items in a storefront page layout into a FAQPage node, or null. */
function buildFaqNode(layout: Page['layout']): JsonLdNode | null {
  if (!layout) return null

  const items = layout
    .filter((block): block is Extract<NonNullable<Page['layout']>[number], { blockType: 'faq' }> =>
      block.blockType === 'faq',
    )
    .flatMap((block) => block.items ?? [])
    .filter((item): item is { question: string; answer: string } => !!item.question && !!item.answer)

  return faqPageFromItems(items)
}

/**
 * Build a schema.org FAQPage node from a plain list of question/answer pairs, or
 * null when the list is empty. Shared by storefront page layouts (via
 * `buildFaqNode`) and the marketing home (via `buildSiteJsonLd`).
 */
export function faqPageFromItems(items: { question: string; answer: string }[]): JsonLdNode | null {
  const mainEntity = items
    .filter((item) => item.question && item.answer)
    .map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    }))

  if (mainEntity.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  }
}

interface BuildArticleJsonLdArgs {
  title: string
  description: string
  /** Absolute canonical URL of the post. */
  url: string
  datePublished: string
  author: string
  /** Absolute OG image URL. */
  image: string
  /** Absolute platform origin, for the publisher logo. */
  origin: string
}

/** schema.org BlogPosting for a blog post. A team byline maps to Organization,
 *  a personal byline to Person. */
export function buildArticleJsonLd({
  title,
  description,
  url,
  datePublished,
  author,
  image,
  origin,
}: BuildArticleJsonLdArgs): JsonLdNode {
  const authorNode = /\bteam\b/i.test(author)
    ? { '@type': 'Organization', name: author }
    : { '@type': 'Person', name: author }

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished,
    author: authorNode,
    image,
    publisher: {
      '@type': 'Organization',
      name: 'Niblr',
      logo: { '@type': 'ImageObject', url: `${origin}/niblr-email-logo.png` },
    },
  }
}

interface BuildSiteJsonLdArgs {
  /** Absolute origin of the platform site, e.g. `https://niblr.store` (no trailing slash). */
  origin: string
  /** Marketing FAQ, rendered as a FAQPage node so answer engines can quote it. */
  faqs?: { question: string; answer: string }[]
}

/**
 * Structured data for the Niblr marketing home: Organization (brand + socials),
 * SoftwareApplication (the open-source product and its pricing offers), and
 * WebSite (with a site SearchAction) — plus an optional FAQPage. Returns an array
 * of top-level nodes rendered in a single ld+json script.
 */
export function buildSiteJsonLd({ origin, faqs }: BuildSiteJsonLdArgs): JsonLdNode[] {
  const organization: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Niblr',
    url: origin,
    logo: `${origin}/niblr-email-logo.png`,
    // `sameAs` asserts a profile a crawler can fetch; omit it while the repo 404s.
    ...(REPO_IS_PUBLIC ? { sameAs: [REPO_URL] } : {}),
  }

  const softwareApplication: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Niblr',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Open-source, multi-tenant commerce. Your domain, your payment keys, your data — hosted or self-hosted, with no platform fees on sales.',
    url: origin,
    license: 'https://opensource.org/licenses/MIT',
    offers: [
      {
        '@type': 'Offer',
        name: 'Self-hosted',
        price: '0',
        priceCurrency: 'USD',
        description: 'MIT-licensed. Deploy to your own Vercel + Postgres.',
      },
      {
        '@type': 'Offer',
        name: 'Hosted',
        price: '10',
        priceCurrency: 'USD',
        description: 'Managed hosting during beta. 0% platform fees on sales.',
      },
    ],
  }

  const website: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Niblr',
    url: origin,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/docs?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  const nodes: JsonLdNode[] = [organization, softwareApplication, website]

  const faq = faqs ? faqPageFromItems(faqs) : null
  if (faq) nodes.push(faq)

  return nodes
}

/** Best-effort plain text from a Payload Lexical richtext value — concatenates every text node.
 *  Used to give the Product JSON-LD a description without markup. Returns '' when there is nothing. */
export function lexicalToPlainText(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const root = (data as { root?: unknown }).root
  if (!root) return ''
  const parts: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { text?: unknown; children?: unknown }
    if (typeof n.text === 'string') parts.push(n.text)
    if (Array.isArray(n.children)) n.children.forEach(walk)
  }
  walk(root)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export interface BuildProductJsonLdArgs {
  name: string
  description?: string
  /** Absolute image URLs. */
  images: string[]
  sku?: string
  currency: string
  /** Base price in minor units (used only when there are no variants). */
  price: number
  /** Base stock (used only when there are no variants). */
  stock: number
  /**
   * When set, `stock` is not inventory and availability is never gated on it —
   * see `isInStock`. A gift card is generated on demand, so publishing
   * `OutOfStock` to Google off a schema-default 0 would be a lie in a rich
   * result, on the one surface a merchant can neither see nor correct.
   */
  issuesGiftCard?: boolean | null
  /** Variant prices/stock in minor units. */
  variants: { price: number; stock: number }[]
  specifications: { label: string; value: string }[]
  /** Absolute canonical URL of the PDP. */
  url: string
  storeName: string
}

/** schema.org Product for a PDP. Emits AggregateOffer across variants (else a single Offer),
 *  and each specification as a PropertyValue in additionalProperty. */
export function buildProductJsonLd({
  name, description, images, sku, currency, price, stock, issuesGiftCard, variants, specifications, url, storeName,
}: BuildProductJsonLdArgs): JsonLdNode {
  const product = { issuesGiftCard }
  const anyInStock =
    variants.length > 0
      ? variants.some((v) => isInStock(product, v.stock))
      : isInStock(product, stock)
  const availability = `https://schema.org/${anyInStock ? 'InStock' : 'OutOfStock'}`

  const offers: JsonLdNode =
    variants.length > 0
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: currency,
          lowPrice: Math.min(...variants.map((v) => fromMinor(v.price, currency))),
          highPrice: Math.max(...variants.map((v) => fromMinor(v.price, currency))),
          offerCount: variants.length,
          availability,
        }
      : { '@type': 'Offer', priceCurrency: currency, price: fromMinor(price, currency), availability }

  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    url,
    brand: { '@type': 'Brand', name: storeName },
    offers,
  }
  if (description) node.description = description
  if (images.length > 0) node.image = images
  if (sku) node.sku = sku
  if (specifications.length > 0) {
    node.additionalProperty = specifications.map((s) => ({
      '@type': 'PropertyValue',
      name: s.label,
      value: s.value,
    }))
  }
  return node
}
