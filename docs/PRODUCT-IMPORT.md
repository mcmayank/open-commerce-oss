# Spec: product import from an existing store

**Created:** 4 August 2026
**Read first:** `CLAUDE.md`, then `docs/MEDIA-PIPELINE.md`.
**Tier:** Free. Capped by `the plan limits[plan].maxProducts` — **30 on Free today**, see the
note in Task 8. Uncapped is not a thing; every tier has a ceiling.
**Blocks on:** MEDIA-PIPELINE Tasks 1–3. **Task 0 was run on 4 Aug 2026 and passed.**

---

## Why

The product hook is "zero to live in under 10 minutes". Today those ten minutes assume
the merchant types their catalog in by hand, which nobody with a real catalog does.
Manual entry is the largest switching cost between an existing Shopify or WooCommerce
store and Niblr, and it is entirely removable.

Scope is deliberately narrow: structured source endpoints only. A Shopify store exposes
its catalog as JSON at a public URL. A modern WooCommerce store does the same through
the Store API. Between them they cover most realistic migration targets, and neither
requires scraping, crawling, or a model.

## Non-goals

Explicitly out of scope. Do not build these, do not stub them, do not add config fields
anticipating them.

- Generic HTML scraping or schema.org / JSON-LD extraction.
- Any LLM-based extraction or normalisation.
- Crawling. This fetches known endpoints on one origin, nothing else.
- Importing customers, orders, discounts, pages, themes, or navigation.
- Currency conversion. See Task 2 and Task 7.
- Scheduled or continuous re-sync. The import is a one-time operation that can be re-run
  manually.

---

## Task 0 — Preflight — **Run 4 Aug 2026. Passed.**

This task gates every other task. It was run; the findings below replace the
"stated from memory" mechanics that Tasks 3 and 4 originally carried.

### Part A — the media pipeline gate

Bulk import is the highest-volume image write this platform will ever do. Running it
against an unprocessed `Media` collection means writing hundreds of raw multi-megabyte
originals into a bucket whose byte counter is already known to be wrong, right before
that counter becomes a commercial gate.

| Check | Result |
|---|---|
| `Media.ts` declares `upload.imageSizes`, `upload.formatOptions`, explicit `upload.mimeTypes` | **Pass** — all three present |
| `totalStoredBytes(doc)` exists and **both** `afterChange` and `afterDelete` use it | **Pass** — `src/lib/media-usage.ts:37`; used at `Media.ts:145,158,160` and `:173` |
| An upload size ceiling is enforced | **Pass** — `payload.config.ts:95`, `limits: { fileSize: 25 * 1024 * 1024 }` |

MEDIA-PIPELINE Tasks 1, 2 and 3 are all Shipped. **Nothing blocks.** If a future reader
finds any of the three missing, stop and report which — do not implement them here and
do not proceed with a partial version.

### Part B — source-API ground truth

Verified against **live stores**, not documentation. This matters: the top-ranked
community answers for Shopify pagination are wrong, and four details differ from what a
reasonable person would assume.

**Shopify `/products.json`**

| | |
|---|---|
| Path | `/products.json` on the storefront origin. Unauthenticated, HTTP 200 |
| Default page size | 30 |
| `limit` ceiling | **250**. `limit=251` **silently clamps** to 250 — no error |
| Pagination | **`?page=` works.** Pages 1 and 2 return disjoint handles |
| Hard ceiling | **`page × limit ≤ 25000`** |
| Image URL shape | `https://cdn.shopify.com/s/files/1/<shop>/files/<name>.jpg?v=<ts>` |
| Price | decimal **string**, major units, e.g. `'12.00'` |

- **The 25 000 wall returns HTTP 200** with body `{"errors":"Page * Limit exceeds the
  25000 limit."}` and **no `products` key**. Paging "until a page returns zero products"
  throws on `.products.length` instead of terminating. Three terminators are required.
- **There is no currency anywhere in the payload.** Product keys are exactly
  `body_html, created_at, handle, id, images, options, product_type, published_at, tags,
  title, updated_at, variants, vendor`.
- **No total count and no `next` link.** There is no authoritative total to show progress
  against.
- **Image URLs carry no size suffix.** They arrive as the master already, so there is
  nothing to strip. Both `?width=800` and an `_800x` filename infix work as *additions*
  (measured: 120 565 → 25 165 bytes).

**WooCommerce Store API `/wp-json/wc/store/v1/products`**

| | |
|---|---|
| Auth | **Unauthenticated read confirmed** |
| `per_page` max | **100**. `per_page=101` → **HTTP 400** `rest_invalid_param` |
| Pagination | `?page=`, with `X-WP-Total` and `X-WP-TotalPages` headers |
| Price | integer **minor units** as a string, exponent declared |

```json
"prices": { "price": "195", "regular_price": "195",
            "currency_code": "USD", "currency_minor_unit": 2 }
```

`"195"` with `currency_minor_unit: 2` is $1.95.

- **The two sources fail in opposite directions** — Shopify silently clamps an over-limit
  page size, Woo hard-400s it. Each adapter owns its own paging loop; do not write a
  clever generic one.
- **Variations carry ids and attribute names only, no prices:**
  `"variations": [ { "id": 1485, "attributes": [ { "name": "Set Screw Size", "value": null } ] } ]`
- Fetching `/products/{variation_id}` returns the real record — `type: "variation"`,
  `parent: <id>`, its own `sku` and `prices`. **`?include=1485,1486` returns zero
  results.** Variations cannot be batch-fetched. The N+1 is unavoidable; see Task 4.

**Payload 3 Local API with a remote file** — installed version **3.86.0**

`payload.create({ collection, data, file | filePath })`. `filePath` is an absolute disk
path. `file` is **not** the Web `File` — it is Payload's own type from
`payload/dist/uploads/types.d.ts`:

```ts
export type File = { data: Buffer; mimetype: string; name: string; size: number; tempFilePath?: string }
```

A remote image is: fetch → `Buffer` → pass that object. No temp file. It routes through
the normal create operation into `generateFileData`, so sharp, `imageSizes` and every
Media hook run.

**The currency helper already exists.** `src/payments/core/money.ts` is canonical:
`currencyExponent`, `fromMinor`, `toMinor`, `formatMoney`. It already handles exponent 3
for **KWD, BHD, OMR, JOD** (plus IQD, LYD, TND) and zero-decimal for JPY. `src/lib/money.ts`
is a pure re-export. **Do not write a second exponent table.** What is missing is the
inbound exact-string parser — see Task 2.

---

## Task 1 — Safe fetching

**New file:** `src/imports/core/fetch.ts`

This feature makes the server fetch URLs supplied by a user. That is an SSRF primitive
unless it is constrained. Build one `safeFetch` and make it the only way any import code
reaches the network.

Requirements:

- HTTPS only. If the merchant pastes `http://`, attempt the HTTPS equivalent and use it
  if it resolves; otherwise reject with a clear message.
- Resolve the hostname and reject any address in a private, loopback, link-local,
  multicast, unique-local or carrier-grade-NAT range. **This check must run again after
  every redirect**, not only on the initial URL, because a public host can redirect to
  `169.254.169.254`.
- Maximum 3 redirects, followed manually (`redirect: 'manual'`).
- 10s connect timeout, 30s total per request.
- Hard response size cap: 10 MB for JSON, 25 MB for image bytes, enforced by **streaming
  and aborting** rather than by trusting `Content-Length`.
- Send no cookies, no credentials, no `Authorization`. A fixed `User-Agent` identifying
  Niblr with a contact URL.
- Per-origin concurrency of 2 and a minimum 250 ms gap between requests to the same
  origin, so an import never looks like an attack to the source host. **See the throughput
  note in Task 4 before fixing these numbers** — they interact badly with the WooCommerce
  variation N+1.
- Return a typed result rather than throwing raw. The review UI has to explain failures
  to a merchant, so `{ ok: false, reason: 'BLOCKED_HOST' | 'TIMEOUT' | 'TOO_LARGE' |
  'HTTP_ERROR' | 'NETWORK', status?, message }` beats a stack trace.
- Retry only idempotent GETs, only on 429/5xx/network error, twice, with backoff that
  honours `Retry-After`.

**Acceptance:** unit tests covering each rejected address class, a redirect chain ending
at a private address, a response exceeding the size cap mid-stream, a timeout, and a 429
that succeeds on retry. DNS is injected so tests do not hit the network. No other file in
`src/imports/` calls `fetch` directly — enforce with a lint rule or a test that greps the
directory.

---

## Task 2 — Source adapter contract and registry

**New files:** `src/imports/core/types.ts`, `src/imports/core/source-registry.ts`

Follow the payments convention exactly (`CLAUDE.md`, Conventions): an adapter per source
in `src/imports/sources/<id>.ts`, registered in one registry, and **nothing else in the
codebase may branch on a source slug**. The point of doing two sources now rather than one
is to prove that boundary holds before a third arrives.

```ts
export interface ImportSource {
  id: string
  label: string
  /** Cheap probe. Returns null if this adapter does not handle the origin. */
  detect(origin: URL): Promise<DetectResult | null>
  /** Yields normalised products, paging internally. */
  listProducts(ctx: SourceContext): AsyncIterable<SourceProduct>
}
```

The canonical intermediate shape. Every adapter returns this; nothing downstream knows
which platform it came from.

```ts
type SourceProduct = {
  externalId: string          // stable id on the source platform
  sourceUrl: string
  title: string
  descriptionHtml: string     // ALREADY SANITISED — see below
  vendor?: string
  productType?: string
  tags: string[]
  options: { name: string; values: string[] }[]
  variants: SourceVariant[]
  images: SourceImage[]
  status: 'active' | 'draft'
}

type SourceVariant = {
  externalId: string
  title: string
  optionValues: string[]      // index-parallel to SourceProduct.options
  priceMinor: number          // integer minor units, per CLAUDE.md
  currency: string            // ISO 4217 as reported by the source
  compareAtMinor?: number
  sku?: string
  barcode?: string
  inventoryQuantity?: number | null
  imageExternalId?: string
  weightGrams?: number | null
}

type SourceImage = { externalId: string; url: string; alt?: string; position: number }
```

`AsyncIterable` rather than an array is deliberate: the discover phase must be able to
stop at the plan cap without buffering 25 000 products first.

### On money

Shopify returns prices as decimal strings (`"25.00"`). **Do not do
`Math.round(parseFloat(p) * 100)`.** Float rounding is banned by `CLAUDE.md`, and `* 100`
is simply wrong for the three-decimal currencies in the primary market: KWD, BHD, OMR and
JOD all have a minor-unit exponent of 3.

The exponent table exists (Task 0) — `currencyExponent` from `src/payments/core/money.ts`.
**The exact string parser does not.** `toMinor` takes a `number`, so routing a decimal
string through it means `Number("12.00")`, a float step next to a price.
`src/lib/export/money.ts:6` already makes this argument for the outbound direction and
shifts digits as a string instead. Write the inbound mirror:

**New file:** `src/lib/money-exact.ts`, holding the existing `formatMinorExact` (moved)
and:

```ts
/** Parse an exact decimal major-unit string into integer minor units. */
export function parseMinorExact(decimal: string, currency: string): number
```

`src/lib/export/money.ts` re-exports `formatMinorExact` from it so existing callers are
untouched.

- Shift digits as a **string** using `currencyExponent(currency)`. Never divide, never
  multiply by a power of ten in floating point, never call `Number()` on the whole value.
- Accept optional sign, digits, one separator, digits. Reject thousands separators,
  currency symbols and exponent notation. Sources emit machine-formatted decimals; a comma
  means we have misread the feed and should stop, not guess.
- **Reject fraction digits that would lose value.** `"12.005"` in USD is neither 1200 nor
  1201 — it is a feed we do not understand. Throw.

  > **Refined while implementing (4 Aug 2026).** This rule originally read "reject more
  > fraction digits than the currency allows", full stop. That is wrong and would have
  > broken every zero-decimal import: Shopify emits two decimal places whatever the
  > currency, so a JPY store reports `"1200.00"` and a strict rule refuses it. The
  > implemented rule drops excess digits when they are **all zero** and throws only when
  > a non-zero digit sits past the currency's precision. `"1200.00"` in JPY is 1200;
  > `"1200.50"` in JPY still throws, because that amount cannot exist.
- Pad short fractions: `"12.5"` in USD → `1250`; `"12"` in KWD → `12000`.

This reuses the canonical exponent table. It is not a second source of truth.

### The currency rule is asymmetric, and the asymmetry is the point

The two sources need **opposite** handling. This is the single easiest way to corrupt
every price in a catalog silently, so it is stated here once and referenced from Tasks 3,
4 and 7.

- **Shopify — convert at face value against the store's currency.** The feed carries no
  currency at all, but `"12.00"` is unambiguous as *twelve major units*. Converting with
  the **target** store's exponent is always a correct unit conversion: `1200` in AED,
  `12000` in KWD. What we cannot know is whether the source store was *priced* in the same
  currency — a value question, not a unit question. Convert, and make Task 7 say plainly
  which currency the figures will be read as.
- **WooCommerce — refuse on mismatch.** Woo sends integer minor units, meaningless without
  their exponent. A KWD source (exp 3) read into an AED store (exp 2) is wrong by a factor
  of ten on every product, and it looks plausible. So:
  - `prices.currency_code` ≠ store currency → **refuse the whole run**, naming both
    currencies. No FX. No conversion.
  - `prices.currency_minor_unit` ≠ `currencyExponent(currency_code)` → **refuse**. The feed
    contradicts ISO 4217 and something upstream is wrong.
  - Otherwise `parseInt` the string directly. It is already minor units. No decimal shift.

Store currency comes from `StoreSettings.currency`, today a select of `AED, INR, USD, EUR,
GBP` — none three-decimal. The exponent-3 paths are therefore exercised only by *source*
currencies and by unit tests. They must still be correct; three of the four are GCC.

### On description HTML

`descriptionHtml` is arbitrary HTML from a third-party site, going into a `richText` field
that renders on the merchant's own storefront. **Sanitise it at the adapter boundary**, so
nothing unsanitised ever enters `SourceProduct`: strip `<script>`, `<iframe>`, `<object>`,
`<embed>`, every `on*` event-handler attribute, and `javascript:` / `data:` URLs. Storing
it raw makes every import a stored-XSS vector on a `*.niblr.store` subdomain.

**Acceptance:** the types compile; the registry resolves adapters by id;
`grep -rn "'shopify'\|'woocommerce'" src/ --include=*.ts` returns hits only inside
`src/imports/sources/` and the registry file. Unit tests for `parseMinorExact` covering
exponent 0/2/3, short and long fractions, over-precision rejection, negatives and junk.

---

## Task 3 — Shopify adapter

**New files:** `src/imports/sources/shopify.ts`, `shopify.test.ts`

Mechanics below are **verified** (Task 0, 4 Aug 2026), not assumed.

- Catalog endpoint: `GET {origin}/products.json?limit=250&page=N`. Public, no credentials.
- Detection, in order of cost: an `x-shopid` response header on the origin;
  `cdn.shopify.com` references in the homepage HTML; a successful `products.json` fetch
  whose body parses to an object with a `products` array.
- **Pagination terminates on three signals, not one:** a page with fewer than 250
  products, an empty array, **or a body containing an `errors` key**. The last is the
  `page × limit ≤ 25000` wall, which returns **HTTP 200 with no `products` key** — code
  that reads `body.products.length` throws there instead of stopping. Keep a hard cap of
  40 pages as a backstop and surface a warning if it is hit.

Handle these, because they are common and none should produce a stack trace:

- The endpoint is disabled or password-protected — HTML, 401 or 404. Fail with "This
  Shopify store has its public product feed turned off", not a JSON parse error.
- `variants[].price` is a decimal string. Use `parseMinorExact` with the **store's**
  currency, per the asymmetric rule in Task 2. There is no currency in this feed to check
  against.
- **Image URLs arrive as the master** — `…/files/<name>.jpg?v=<ts>`, no size suffix to
  strip. Append `?width=2000` rather than sending the raw master: the media pipeline caps
  at 2000px wide anyway (`resizeOptions`), so the stored result is byte-identical while
  the download is materially smaller, and if Shopify ever ignores the parameter you get
  the master back, which is still correct. This degrades safely in both directions.
- `products.json` does not report whether prices are tax-inclusive; that lives on the shop
  object. Do not guess. Task 7 asks the merchant.
- **Inventory quantity is absent from this endpoint.** Map it to `null`, not `0`. Importing
  a catalog as entirely out of stock is a support ticket. Task 8 turns `null` into the
  collection's required `stock: 0` *and* attaches a warning, so the merchant is told.

**Acceptance:** capture a real response from a live Shopify store into
`src/imports/sources/__fixtures__/shopify-products.json` and commit it. Mapper tests run
against the fixture with no network. Cover: a multi-option multi-variant product, a
single-variant product, a product with no images, a three-decimal target currency
(`"12.00"` → `12000`), termination on all three paging signals, and a `<script>` in
`body_html` that does not survive sanitisation.

---

## Task 4 — WooCommerce adapter

**New files:** `src/imports/sources/woocommerce.ts`, `woocommerce.test.ts`

Mechanics below are **verified** (Task 0, 4 Aug 2026).

- Catalog endpoint: `GET {origin}/wp-json/wc/store/v1/products?per_page=100&page=N`. The
  public Store API, read-only and unauthenticated. **Do not use `wc/v3`**, which needs a
  consumer key and secret and turns onboarding into a credentials exercise.
- Detection: fetch `{origin}/wp-json/` and check whether `wc/store/v1` appears in the
  advertised namespaces. One cheap request, definitive.
- **`per_page` maximum is 100.** `per_page=101` is a hard `400 rest_invalid_param`, not a
  clamp. Never send more.
- Terminate using `X-WP-TotalPages`; fall back to paging until an empty array.
- Prices are **already minor units** with a `currency_minor_unit` field. Apply the
  asymmetric currency rule from Task 2 **before mapping any price**, and fail the whole run
  rather than per-product — a currency or exponent mismatch is not a bad row, it is a wrong
  import.
- `type: 'simple'` → one product, no variants, price from `prices.price`.
- `type: 'variable'` → `variations[]` carries **ids and attribute names only, no prices**.
  Fetch each id via `/products/{id}`, which returns `type: 'variation'`, `parent`, its own
  `sku` and `prices`. **`?include=` does not batch them** — this was tested and returns
  zero results. Build `optionValues` from the variation's `attributes`.
- Map `attributes[].terms[]` (where `has_variations` is true) onto `options`.
- `is_in_stock` and `low_stock_remaining` are the only stock signals. Map conservatively
  and document the approximation.
- Sanitise `description` as in Task 2.
- If the namespace is absent, fail with "This store is running a WooCommerce version
  without the public product API", and stop.

### The N+1 collides with Task 1's rate limit — decide before implementing

A 500-product catalog where every product is variable with 5 variants is **~2 500
additional requests**. Under Task 1's per-origin limits (concurrency 2, 250 ms minimum
gap) that is a **five-minute floor**, before a single image is fetched.

Pick one, and write the choice into the code as a comment:

1. **Relax the gap for variation fetches** on the same origin already being paged (e.g.
   concurrency 4, no minimum gap), accepting more load on the merchant's own server.
2. **Keep the limits and make Task 7 honest** — show the projected variation count and
   an estimated duration on the review screen before the merchant commits.

Option 2 is the default: the politeness limits exist for a reason and a slow, predictable
import beats a fast one that gets us rate-limited by the source host.

**Acceptance:** committed fixture, mapper tests with no network, plus: one simple product,
one variable product with two variations, `per_page` never exceeding 100, termination via
`X-WP-TotalPages`, a refused KWD-source-into-AED-store run, and a refused run where
`currency_minor_unit` contradicts the currency code.

---

## Task 5 — Job model

**New files:** `src/collections/ImportJobs.ts`, `src/collections/ImportItems.ts`, plus a
migration in `src/migrations/`.

Both collections are store collections (`STORE_COLLECTIONS`), scoped per tenant by the
hosted overlay like everything else. A merchant must never see another tenant's import.

This is a Free-tier feature, so it must work in the open-source single-store build. Scope
queries and writes with `storeWhere`/`storeRef`/`storeIdOf` (`src/store-scope.ts`) and
nothing else, per `CLAUDE.md`. Verify the whole flow runs in the exported tree
(`pnpm oss:export`, then the run steps in its README) before calling this done. If the import path ends up depending on multi-tenant-only code,
that is a design error, not an acceptable trade.

`ImportJobs`: `tenant`, `sourceUrl`, `sourceId`, `status` (`detecting` / `ready` /
`importing` / `completed` / `failed` / `cancelled`), `detectedProductCount`,
`selectedCount`, `importedCount`, `failedCount`, `sourceCurrency`, `pricesIncludeTax`
(boolean, set in Task 7), `ownershipAttestedAt`, `ownershipAttestedBy`, `error`,
`createdBy`.

`ImportItems`: `job`, `externalId`, `raw` (JSON snapshot of the source payload), `mapped`
(the `SourceProduct`), `status` (`pending` / `selected` / `skipped` / `imported` /
`failed`), `warnings` (array of codes), `error`, `product` (relationship, set on success).

Three phases, and the separation matters:

1. **Discover.** Fetch the catalog JSON, map it, write one `ImportItem` per product. **No
   image bytes are fetched in this phase.** The review grid references source image URLs
   directly. This is the difference between moving 1.6 GB and moving nothing.
2. **Review.** UI only. Zero network calls to the source.
3. **Import.** Only for items the merchant marked `selected`.

**On execution.** Check what background job infrastructure already exists before adding
any. If there is none, do not add a vendor for this. Implement
`POST /api/imports/[id]/tick`, which claims and processes up to N pending items per
invocation and returns the remaining count; the client polls it while the import screen is
open. This fits the serverless model, is resumable after a closed tab, and needs no new
dependency. Guard it with a row-level claim so two concurrent ticks cannot process the same
item twice.

**Do not wrap a run in one transaction.** It can span minutes and thousands of writes;
holding a Postgres transaction open that long is its own outage. Per-item atomicity is the
right granularity, and the report tells the merchant exactly what landed.

**Idempotency.** Every created Product gets an `importedFrom` group:
`{ sourceId, sourceOrigin, externalId, importedAt }`. Re-importing the same external id for
the same tenant **updates** that product instead of creating a duplicate. Test this
explicitly by running the same import twice.

---

## Task 6 — Discover phase

**New file:** `src/imports/core/discover.ts`

Given a job: normalise the pasted URL to an origin, walk the registry calling `detect()` in
order, and on a hit run `listProducts()` to completion, writing `ImportItems` in batches as
they arrive rather than buffering the whole catalog.

Attach warning codes during mapping. These drive the review UI, so keep them as stable
string codes, not prose:

`no_price`, `no_images`, `many_variants` (over 100), `currency_mismatch`,
`boilerplate_description`, `variants_unavailable`, `duplicate_sku`,
`inventory_unknown` (Shopify's absent inventory — Task 3).

If no adapter detects, fail the job with a message naming the two supported platforms and
stating plainly that other platforms are not supported yet. Do not attempt a fallback.

---

## Task 7 — Review screen

**New route** under the existing admin/app group, e.g. `/imports/[id]`.

Three things happen here before anything is written to the catalog.

**One: the merchant confirms two facts that cannot be inferred.**

- **Ownership.** A checkbox: they own or are authorised to import from this store. Persist
  the timestamp and the user. This is not decoration; it is the record you will want to
  exist.
- **Tax treatment.** "Are the prices on your existing store tax-inclusive or
  tax-exclusive?" Required, no default. Getting this wrong makes every price in the catalog
  5% wrong, silently and permanently — and `CLAUDE.md` is explicit that inclusive tax is
  *extraction, not addition*. Since tax is not yet computed at checkout (`src/lib/tax.ts:121`
  returns `taxAmount: 0`), store the answer on the job **and on each imported product** so it
  can be reconciled when Tax/VAT lands.

**Two: currency.** Behaviour differs by source, per the rule in Task 2, and the screen must
reflect that rather than showing one generic notice:

- **Shopify** — the feed has no currency. State plainly: "Prices will be imported as
  `<STORE CURRENCY>`." The merchant confirms or changes the store currency first. No
  conversion is performed and none is implied.
- **WooCommerce** — the source declares its currency. If it differs from the store's, or its
  exponent contradicts ISO 4217, the job has already **failed** in Task 4 and this screen
  shows the failure with both currencies named. There is nothing to confirm; a mismatched
  Woo import is not offered as a choice.

**Never perform an FX conversion. Never quietly relabel USD 25 as AED 25 without saying so.**

**Three: the grid.** Per item: source image thumbnail (referenced from the source URL, not
downloaded), title, price, variant count, warning chips. Bulk select and deselect all.
Inline edit of title, price and draft/active status. Items with `no_price` are deselected
by default and cannot be selected until a price is set.

If the chosen answer to Task 4's throughput question is option 2, show the projected
variation-fetch count and estimated duration here, before the merchant commits.

Nothing is written to `Products` until the merchant presses import. An import that silently
commits a wrong price is worse than no import at all.

---

## Task 8 — Import phase

**New file:** `src/imports/core/import.ts`

Per selected item, in one unit of work:

1. Create or update the Product through `payload.create` / `payload.update` — Local API,
   not HTTP, so every collection hook and access rule fires normally.
2. Map options and variants onto the existing model. Read `src/collections/Products.ts` and
   use what product variants already are; do not invent a parallel structure. Note the shape
   change: `SourceVariant.optionValues` is a `string[]` index-parallel to `options`, while
   the collection stores `optionValues: [{ option, value }]`. Pair them by index at this
   boundary.
3. `stock` is `required` on the collection with `min: 0`, so a `null` `inventoryQuantity`
   becomes `0` here — and carries the `inventory_unknown` warning into the report so the
   merchant knows the number is ours, not theirs.
4. Set `importedFrom` and the tax-treatment flag.
5. Run images (Task 9).
6. Mark the item `imported` and store the product id, or `failed` with the error.

**Import as `status: 'draft'`.** Never publish. The merchant reviews prices and stock —
which we know are approximate — before anything is visible on their storefront.

One item failing must never abort the job. Record it, continue, and show the failures at the
end with a retry-failed-only action.

**Respect the plan cap before starting.** The number lives in `the plan limits` in
**`src/lib/plans.ts`** — not `src/lib/pricing/plans.ts`, which is the derived marketing
catalogue. Never hardcode it here or in a component. Enforce it against the selected count
with a clear message, not silently by truncating. `Products.beforeChange` already calls
`assertProductQuota`, so without a pre-flight a 250-product import creates N products and
then throws, leaving a partial catalog and an error. This is a feature cap, not an order or
GMV gate, so it stays inside the pricing guardrail in `CLAUDE.md`.

> **Open product question.** `the plan limits.free.maxProducts` is **30** today. "Import your
> Shopify store" that stops at 30 products is a thin promise, and Starter is also 30. Decide
> before shipping whether this feature justifies raising the Free cap, or whether import is
> positioned as a paid-tier capability from the start — that changes this spec's tier header
> and the free-build constraint in Task 5. Do not silently ship against 30 and hope.

---

## Task 9 — Images

**New file:** `src/imports/core/media.ts`

The single most expensive part of this feature. Treat it accordingly.

- Fetch image bytes **only for selected items, only during the import phase**.
- Download through `safeFetch` and upload through the Media collection so sharp processing,
  the mime allowlist and the byte counters all run. **Never write to the storage bucket
  directly.** Use the Payload `File` object shape verified in Task 0:
  `{ data: buffer, mimetype, name, size: buffer.length }` — not the Web `File`.
- **Deduplicate by SHA-256 of the downloaded bytes**, within the job. Product image reuse
  across variants is constant and this saves real bandwidth. Reuse the existing Media doc on
  a hash hit.
- Caps: 10 images per product, 25 MB per image (matching `payload.config.ts:95`), and a
  per-job total byte ceiling. Log and warn when a cap truncates rather than failing.
- Derive the mime type from the response `Content-Type`, cross-checked against the
  extension. Do not trust either alone.
- Set `alt` from the source where present.
- **SVG is deliberately absent from the media mime allowlist** and will be rejected on
  upload. Detect it before attempting the upload, skip with a warning, and do not let it
  surface as an upload error.
- The storage quota (`maxStorageBytes`, 250 MB on Free) can be exhausted mid-run. Catch it,
  stop importing images, finish the products, and say so in the report. Products without
  images beat a failed import.
- **An image failure must never fail the product.**

**Acceptance:** import a 20-product Shopify fixture store end to end and confirm every
resulting Media doc has `sizes` populated, that the tenant's `mediaBytesUsed` after the
import matches a fresh `recomputeTenantMediaBytes` run exactly, and that a product sharing
one image across four variants produced one Media doc and not four.

---

## Task 10 — Roadmap and site

- Add rows to `ROADMAP.md` under Commerce features **in the same commit that ships each
  piece**: "Import from Shopify" and "Import from WooCommerce", Tier Free, Priority P1.
  Status moves to Shipped only when it is shipped.
- **Do not put this on the marketing site until the code exists.** Per `CLAUDE.md`, a string
  in a config file is not an implementation, and this project has already shipped five
  phantom features onto a paid tier. When it does ship, it belongs in the ACTION-PLAN 2.3
  batch of shipped-but-invisible features — and the claim must name what actually transfers:
  products as drafts, no orders, no customers, inventory not included from Shopify.

---

## Verification

```
npx tsc --noEmit
npx vitest run
```

Then by hand, against staging:

1. Paste a real Shopify store URL. Confirm detection, product count, and that **no image
   bytes were transferred during discovery** (watch egress or add temporary instrumentation).
2. Paste a real WooCommerce store URL. Same.
3. Paste a URL that is neither. Confirm a clear unsupported-platform message.
4. Paste `http://169.254.169.254/` and a public URL that 302s to a private address. Confirm
   both are rejected before any fetch completes.
5. Deselect half the grid, import, and confirm only the selected products exist, all as
   drafts.
6. Re-run the identical import. Confirm products are updated, not duplicated, and the count
   does not change.
7. Import a Shopify store into a store set to a three-decimal currency. Confirm `"12.00"`
   becomes `12000`, not `1200`.
8. Import a Woo store whose `currency_code` differs from the store default. Confirm the run
   is **refused** with both currencies named and that nothing was created.
9. On a Free-tier tenant, select more products than `the plan limits.free.maxProducts`. Confirm
   a clear cap message rather than a silent truncation.
10. Kill the browser tab mid-import, reopen the job, and confirm it resumes with no
    duplicated products.
11. Confirm `mediaBytesUsed` matches a fresh recount after the import.
12. Import a product whose `body_html` contains `<script>` and an `onerror` attribute.
    Confirm neither survives to the storefront.

Add a Playwright test covering paste URL → review → import against a mocked source origin.

---

## What this unblocks

A merchant with an existing Shopify or WooCommerce store can be live on Niblr in one
sitting, which is the first time the ten-minute claim is true for someone who already sells
things. It also produces the two structural pieces a wider importer would need later: the
`SourceProduct` contract and the discover-review-import job model. Adding a third source
after this should be one folder and one registry line, exactly like adding a payment
provider.
