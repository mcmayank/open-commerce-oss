# Import source fixtures

Real captures, committed so mapper tests run with no network.

## `shopify-products.json`

**Source:** `https://www.blenderbottle.com/products.json?limit=250&page=N`
**Captured:** 4 August 2026
**Why this store:** most Shopify stores split colourways into separate handles, so
every product has a single option. `classic` is a genuine two-axis product
(Size × Color), which is the case that actually exercises the `option1/2/3` →
`optionValues` pairing. Four other stores were checked first and all were single-option.

**Three products, chosen for shape:**

| Handle | Options | Why it is here |
|---|---|---|
| `classic` | Size × Color | Multi-option, multi-variant — the pairing case |
| `one-piece-pro-series` | Color | Single-axis, multiple variants |
| `one-small-step-pro-series` | Size | Single variant |

**What was trimmed, and nothing else:**

- `classic` variants: 39 → 6, keeping two colours from each of the three sizes so
  **both** axes still vary. Its `options[].values` were narrowed to match the kept
  variants, so the fixture stays internally consistent.
- Images: `classic` 60 → 4, `one-piece-pro-series` 14 → 3,
  `one-small-step-pro-series` 5 → 2.

Every field is otherwise byte-for-byte as the endpoint returned it — prices as decimal
strings, `cdn.shopify.com` URLs with their `?v=` cache-busters, absent inventory. Cutting
it to 25 KB from 94 KB is the only reason anything was removed.

**Cases not present in real data** — no-image products, prices needing three-decimal
precision, and `<script>` in `body_html` — are built inline in `shopify.test.ts` rather
than faked into this file, so the capture stays an honest record of what Shopify sends.

## `woocommerce-products.json` and `woocommerce-variation.json`

**Source:** `https://barefootbuttons.com/wp-json/wc/store/v1/products?per_page=20`
and `.../products/1485`
**Captured:** 4 August 2026

One `variable` product and two `simple` ones, plus the real response for the variable
product's variation. The variation file is the important one: it is the evidence that
`/products/{id}` returns a full record with `type: "variation"`, its own `parent`, `sku`
and `prices` — none of which appear in the parent's `variations[]` array, which carries
only ids and attribute names.

**What was trimmed:** `description` and `short_description` truncated to 400 characters
where longer. Nothing else; prices are the real minor-unit integers with their real
`currency_minor_unit`.

**A real multi-variation product is not in here.** Six WooCommerce stores were probed and
the only variable product reachable had a single variation. Rather than fabricate one and
call it a capture, the N+1 fan-out — N variations causing N requests — is tested with a
scripted fetcher in `woocommerce.test.ts`. The per-variation *shape* is real (this file);
only the count is synthetic, and a second variation is structurally another entry in the
same array.

