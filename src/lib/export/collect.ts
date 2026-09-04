import type { Payload } from 'payload'
import { toCsv } from './csv'
import { formatMinorExact } from './money'
import { lexicalToPlainText } from '@/lib/structured-data'
import { storeWhere } from '@/store-scope'

/**
 * Column allowlists and row assembly for the merchant data export.
 *
 * Every column list below is hardcoded ON PURPOSE. `payload.find` is called
 * with `overrideAccess: true`, which bypasses field-level access — so
 * `Customers.passwordHash` and `magicLinkNonce`, both declared
 * `access: { read: () => false }`, are readable here. Building rows by
 * iterating document keys would put scrypt hashes into a file the merchant
 * downloads and forwards. Rows are therefore built by reading named fields,
 * and a field added to any collection later cannot appear in an export
 * without someone adding it to a list here.
 */

/** Loosely typed Payload document — collectors read named fields only. */
type Doc = Record<string, unknown>

export interface ExportFile {
  name: string
  content: string
}

export interface ExportData {
  storeCurrency: string
  products: Doc[]
  categories: Doc[]
  orders: Doc[]
  customers: Doc[]
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const arr = (v: unknown): Doc[] => (Array.isArray(v) ? (v as Doc[]) : [])

/**
 * Integer minor units → exact decimal, or '' when the field is unset.
 *
 * A non-integer means a legacy or direct-SQL write already lost the minor-unit
 * invariant. We emit the stored value rather than throwing: this export is
 * the merchant's escape hatch, and losing the whole archive over one bad cell
 * in one row would defeat the point. But a bare `36.75` is byte-identical to
 * a correctly formatted AED 36.75 while actually being 100x off (it's still
 * minor units, just non-integer ones) — nothing in the cell would signal
 * that. So the degraded value is tagged `(raw)` to make it visibly not a
 * formatted amount, rather than a plausible-looking wrong number.
 */
const money = (v: unknown, currency: string): string => {
  if (typeof v !== 'number') return ''
  return Number.isInteger(v) ? formatMinorExact(v, currency) : `${v} (raw)`
}

/** A related doc resolved by depth, or '' when it was left as a bare id. */
const relTitle = (v: unknown): string =>
  v && typeof v === 'object' ? str((v as Doc).title) : ''

/**
 * A media `url` made absolute against the store's own origin.
 *
 * Payload stores a ROOT-RELATIVE url here — `/api/media/file/tech-earbuds.webp`
 * — not the S3 object address. The s3 adapter only emits an absolute
 * `generateURL` when `disablePayloadAccessControl` is set, and it is not:
 * `payload.config.ts` sets neither that nor `serverURL`, so media deliberately
 * serves through Payload's own route, which applies `mediaReadAccess`. The
 * bucket itself is private (docs/DEPLOY.md).
 *
 * A relative path in a CSV resolves to nothing — the merchant opens the file in
 * Excel, clicks the cell, and gets a dead link. Since "images come along as
 * links" is the whole reason this archive omits the binaries, the link has to
 * actually work, so it is prefixed with the origin the request arrived on.
 *
 * An already-absolute URL is returned untouched, so this keeps working if
 * `disablePayloadAccessControl` is ever enabled or media moves to a CDN. An
 * empty `origin` (no Host header — see `requestOrigin` in the route) also
 * leaves the value alone rather than emitting a `https://null` prefix.
 */
const mediaUrl = (v: unknown, origin: string): string => {
  const url = str(v)
  return origin && url.startsWith('/') ? `${origin}${url}` : url
}

const PRODUCT_COLUMNS = [
  'slug', 'title', 'description', 'status', 'price', 'currency',
  'stock', 'category', 'imageUrls', 'specifications', 'variantCount',
]

const VARIANT_COLUMNS = [
  'productSlug', 'variantTitle', 'optionValues', 'price', 'currency', 'stock',
]

const CATEGORY_COLUMNS = ['slug', 'title', 'description', 'imageUrl']

const ORDER_COLUMNS = [
  'orderNumber', 'createdAt', 'status', 'customerEmail', 'customerName', 'currency',
  'subtotal', 'discountAmount', 'discountCode', 'shippingAmount', 'taxAmount',
  'taxRate', 'taxInclusive', 'total', 'refundedAmount', 'paymentProvider', 'paidAt',
  'fulfillmentMethod', 'trackingNumber', 'invoiceNumber', 'invoiceIssuedAt',
  'shippingName', 'shippingLine1', 'shippingLine2', 'shippingCity',
  'shippingState', 'shippingPostalCode', 'shippingCountry', 'shippingPhone',
]

const ORDER_ITEM_COLUMNS = [
  'orderNumber', 'productId', 'title', 'variantTitle', 'unitPrice', 'qty', 'lineTotal', 'currency',
]

const CUSTOMER_COLUMNS = [
  'email', 'name', 'createdAt', 'lastLoginAt',
  'addressLine1', 'addressLine2', 'addressCity', 'addressState',
  'addressPostalCode', 'addressCountry',
]

const README = `Niblr data export
=================

Files in this archive:

  products.csv          One row per product.
  product-variants.csv  One row per variant, keyed to products.csv by productSlug.
  categories.csv        One row per category.
  orders.csv            One row per order.
  order-items.csv       One row per line item, keyed to orders.csv by orderNumber.
  customers.csv         One row per customer.

Amounts are decimal, in the currency named in the currency column of the same
row. They are exact: no rounding was applied when writing this file.

Two limits worth knowing:

  Images are links, not files. Product and category images appear as full web
  addresses on your own store domain. Open one in a browser, or fetch the
  column with a script, to download the image itself; this archive does not
  contain the image files.

  Only the first address of each customer is included. If a customer saved
  several addresses, the others are not in this file.

Not included: your storefront pages, theme, tax and fulfilment settings. This
archive is a copy of your commercial records — catalog, orders and customers —
rather than a backup of your whole store.
`

function productRows(products: Doc[], currency: string, origin: string): unknown[][] {
  return products.map((p) => [
    str(p.slug),
    str(p.title),
    lexicalToPlainText(p.description),
    str(p.status),
    money(p.price, currency),
    currency,
    str(p.stock),
    relTitle(p.category),
    arr(p.images)
      .map((img) => mediaUrl(img.url, origin))
      .filter(Boolean)
      .join(';'),
    arr(p.specifications)
      .map((s) => `${str(s.label)}: ${str(s.value)}`)
      .join('; '),
    String(arr(p.variants).length),
  ])
}

function variantRows(products: Doc[], currency: string): unknown[][] {
  return products.flatMap((p) =>
    arr(p.variants).map((v) => [
      str(p.slug),
      str(v.title),
      arr(v.optionValues)
        .map((o) => `${str(o.option)}: ${str(o.value)}`)
        .join('; '),
      money(v.price, currency),
      currency,
      str(v.stock),
    ]),
  )
}

function categoryRows(categories: Doc[], origin: string): unknown[][] {
  return categories.map((c) => [
    str(c.slug),
    str(c.title),
    str(c.description),
    c.image && typeof c.image === 'object' ? mediaUrl((c.image as Doc).url, origin) : '',
  ])
}

function orderRows(orders: Doc[], storeCurrency: string): unknown[][] {
  return orders.map((o) => {
    // `currency` is required on Orders, but legacy rows can still have it
    // blank. A blank currency defaulting silently to 2 decimal places would
    // mis-scale a 3-decimal currency (KWD/BHD/OMR) by 10x with no visible
    // sign in the row, so fall back to the store's own currency instead.
    const currency = str(o.currency) || storeCurrency
    const ship = (o.shippingAddress ?? {}) as Doc
    const fulfilment = (o.fulfillment ?? {}) as Doc
    const customer = (o.customer ?? {}) as Doc
    return [
      str(o.orderNumber),
      str(o.createdAt),
      str(o.status),
      str(o.email),
      typeof o.customer === 'object' && o.customer ? str(customer.name) : '',
      currency,
      money(o.subtotal, currency),
      money(o.discountAmount, currency),
      str(o.discountCode),
      money(o.shippingAmount, currency),
      money(o.taxAmount, currency),
      str(o.taxRate),
      str(o.taxInclusive),
      money(o.total, currency),
      money(o.refundedAmount, currency),
      str(o.paymentProvider),
      str(o.paidAt),
      str(fulfilment.method),
      str(o.trackingNumber),
      str(o.invoiceNumber),
      str(o.invoiceIssuedAt),
      str(ship.name),
      str(ship.line1),
      str(ship.line2),
      str(ship.city),
      str(ship.state),
      str(ship.postalCode),
      str(ship.country),
      str(ship.phone),
    ]
  })
}

function orderItemRows(orders: Doc[], storeCurrency: string): unknown[][] {
  return orders.flatMap((o) => {
    const currency = str(o.currency) || storeCurrency
    return arr(o.lineItems).map((li) => [
      str(o.orderNumber),
      str(li.productId),
      str(li.title),
      str(li.variantTitle),
      money(li.unitPrice, currency),
      str(li.qty),
      money(li.lineTotal, currency),
      currency,
    ])
  })
}

function customerRows(customers: Doc[]): unknown[][] {
  return customers.map((c) => {
    // Only the first address; the README says so.
    const address = (arr(c.addresses)[0] ?? {}) as Doc
    return [
      str(c.email),
      str(c.name),
      str(c.createdAt),
      str(c.lastLoginAt),
      str(address.line1),
      str(address.line2),
      str(address.city),
      str(address.state),
      str(address.postalCode),
      str(address.country),
    ]
  })
}

/**
 * @param origin The store's own absolute origin, e.g. `https://sdbakery.ae`, used
 *   to make root-relative media URLs downloadable. See `mediaUrl` above.
 */
export function buildExportFiles(data: ExportData, origin: string): ExportFile[] {
  const c = data.storeCurrency
  return [
    { name: 'products.csv', content: toCsv(PRODUCT_COLUMNS, productRows(data.products, c, origin)) },
    { name: 'product-variants.csv', content: toCsv(VARIANT_COLUMNS, variantRows(data.products, c)) },
    { name: 'categories.csv', content: toCsv(CATEGORY_COLUMNS, categoryRows(data.categories, origin)) },
    { name: 'orders.csv', content: toCsv(ORDER_COLUMNS, orderRows(data.orders, c)) },
    { name: 'order-items.csv', content: toCsv(ORDER_ITEM_COLUMNS, orderItemRows(data.orders, c)) },
    { name: 'customers.csv', content: toCsv(CUSTOMER_COLUMNS, customerRows(data.customers)) },
    { name: 'README.txt', content: README },
  ]
}

/** Page size for every collection read. Bounded memory, bounded round trips. */
const PAGE_SIZE = 500

async function fetchAll(
  payload: Payload,
  collection: 'products' | 'categories' | 'orders' | 'customers',
  tenantId: string | number,
  depth: number,
): Promise<Doc[]> {
  const docs: Doc[] = []
  let page = 1
  for (;;) {
    const result = await payload.find({
      collection,
      where: storeWhere(tenantId),
      limit: PAGE_SIZE,
      page,
      depth,
      overrideAccess: true,
      // `id` is unique, so the drizzle query builder appends it as a stable
      // tiebreaker. Sorting by `createdAt` alone does not: drizzle only adds
      // a fallback sort when the requested sort doesn't already mention
      // `createdAt`, so an `ORDER BY created_at` with ties (bulk seeding,
      // imports) has unspecified order across paged queries and can drop or
      // duplicate rows at a page boundary. A silently incomplete export is
      // worse than an unsorted one.
      sort: 'id',
    })
    docs.push(...(result.docs as unknown as Doc[]))
    if (!result.hasNextPage) return docs
    page += 1
  }
}

export async function collectExportData(
  payload: Payload,
  tenantId: string | number,
): Promise<ExportData> {
  const [products, categories, orders, customers, settings] = await Promise.all([
    // depth 1 resolves category/image relationships to get titles and URLs.
    fetchAll(payload, 'products', tenantId, 1),
    fetchAll(payload, 'categories', tenantId, 1),
    // depth 1: `customer` must resolve so orderRows can read customer.name —
    // a customer's own name, not their email, is what the customerName
    // column promises. (customers itself stays at depth 0 below: addresses
    // is an embedded array, not a relation, so nothing there needs resolving.)
    fetchAll(payload, 'orders', tenantId, 1),
    fetchAll(payload, 'customers', tenantId, 0),
    payload.find({
      collection: 'store-settings',
      where: storeWhere(tenantId),
      limit: 1,
      depth: 0, // only `currency` is read; no relation needs resolving
      overrideAccess: true,
    }),
  ])

  // `currency` is a top-level field: StoreSettings' tabs are unnamed and
  // therefore presentational, so no `general.` prefix applies.
  const storeCurrency = str((settings.docs[0] as unknown as Doc)?.currency) || 'AED'

  return { storeCurrency, products, categories, orders, customers }
}
