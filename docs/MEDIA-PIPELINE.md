# Spec: media ingest pipeline and image serving

**Created:** 25 July 2026
**Read first:** `CLAUDE.md`. This spec lands before the plan-tier migration, because
generous storage caps are only safe once ingest is processing images.

---

## Why

Three problems, all live in production today.

**1. Raw originals are stored.** `src/collections/Media.ts` declares `upload: true`
with no `imageSizes`, no `formatOptions`, and no `resizeOptions`. Whatever a merchant
uploads is what gets written to the bucket. A phone photo is 3-5 MB and lands as 3-5 MB.

**2. Raw originals are served.** There is not one `next/image` in the storefront.
All 18 image render sites use `<img src={media.url}>`, which serves the stored file at
full dimensions in its original format to every device. A shopper on mobile data
downloads the merchant's full-resolution photo. This is the most damaging of the three
and it affects every storefront on the platform right now.

**3. Any file type is accepted.** `Media` sets no `mimeTypes`. A tenant can upload
`.html`, `.pdf`, `.zip` or an executable and Niblr will serve it from a
`*.niblr.store` subdomain. That is a phishing host carrying your domain name. Fix this
regardless of anything else in this spec.

Expected effect of the work below: roughly a 20x reduction in stored bytes and a much
larger reduction in bytes delivered, since the storefront will stop shipping 2000px
images into 400px slots.

---

## Task 0 — Confirm which bucket this actually is — **Done 26 Jul 2026**

**Answer: Cloudflare R2.** `S3_ENDPOINT` in Vercel production is
`https://<account>.r2.cloudflarestorage.com`, bucket `niblrstore`, region `auto`.
So the free allowance is **10 GB**, not Supabase's 1 GB, and egress is free. The
stale comment was corrected in PR #81. Current usage at the time of writing: 52
objects, ~82 MB — under 1% of the free tier.

**Local development no longer touches this bucket** (26 Jul 2026). `.env` sets no
`S3_BUCKET`, so `payload.config.ts` skips the s3Storage plugin and Payload writes
to `./media` — the same path a self-host install uses. Previously `.env` pointed at
the production bucket while `.env.local` pointed the database at localhost, so a
routine `pnpm dev` upload or delete reached production objects; that is why every
destructive script carries an environment guard. The guards remain as a backstop.

A dedicated development *bucket* was considered and not created: the R2 credentials
in the repo are scoped to `niblrstore` and cannot create or even list buckets, so it
needs Cloudflare dashboard access. Disk storage solves the actual danger without one.

**Media is proxied**, not served from the bucket: every image goes through
`/api/media/file/**`, streamed (no redirect), and the Vercel CDN does not cache it
(`x-vercel-cache: MISS` on repeat requests, `cache-control: max-age=0,
must-revalidate`). A conditional request with a matching ETag does return 304, so a
returning visitor pays an invocation but not the egress; a cold visitor pays both.
That splits the cost into two independent levers — shrinking files (Tasks 1 and 4)
cuts egress, adding a real `cache-control` cuts invocations.

**The caching lever was not in this spec. It shipped 26 Jul 2026** as
`next.config.ts` `headers()`: `/api/media/file/**` now serves
`public, max-age=31536000, immutable`. Safe to cache immutably because these URLs
are content-addressed in practice — replacing a file on an existing doc yields a
new filename (verified). Safe to cache publicly because every response on that
path is identical regardless of who asks, which holds only while the collection is
image-only; `Media.test.ts` pins that coupling. `/api/invoices/file/**` is
deliberately excluded — invoices are private.

The original question and its reasoning, kept for the record:

This matters because the free tiers differ by an order of magnitude, and the storage
caps in the plan-tier work will be set from it:

| | Free allowance | Beyond |
|---|---|---|
| Cloudflare R2 | 10 GB | $0.015/GB-mo, zero egress |
| Supabase Storage (Free) | 1 GB | plan-dependent, egress metered |

Read `S3_ENDPOINT` from the deployed environment, report which provider it points at,
and correct the stale comment. **Do not guess.** Everything downstream is sized off
this answer.

Also confirm whether media is served straight from the bucket or proxied through
Payload's `/api/media/file/**` route. `next.config.ts` has a `localPatterns` entry for
that path, which suggests proxying. If it is proxied, every image request hits a
serverless function, which is both a latency cost and a Vercel invocation cost that no
one has measured. Report the answer; do not change it in this task.

---

## Task 1 — Process images at ingest — **Shipped 26 Jul 2026**

**File:** `src/collections/Media.ts`

Add an upload config. `sharp` is already a dependency (`package.json:55`) and already
imported in `payload.config.ts:10`, so this is configuration, not a new library.

Target shape:

```ts
upload: {
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
  formatOptions: { format: 'webp', options: { quality: 82 } },
  resizeOptions: { width: 2000, withoutEnlargement: true },
  imageSizes: [
    { name: 'thumb', width: 400,  withoutEnlargement: true },
    { name: 'card',  width: 800,  withoutEnlargement: true },
    { name: 'hero',  width: 1600, withoutEnlargement: true },
  ],
}
```

**Verify every key against the Payload 3 upload documentation before shipping.** In
particular, find the correct option for a maximum accepted upload size; it may be
`upload.limits.fileSize`, a collection-level setting, or a Next body-size limit, and I
am not certain which. Set the ceiling to **25 MB**.

That ceiling is an abuse guard, not a compression lever. It exists so nobody uploads a
2 GB TIFF. It must never be tight enough that a normal phone photo is rejected: an
upload failure during store setup is a churn event, and telling merchants to go
compress their own images before using the product is not an acceptable answer.

**On SVG.** Deliberately excluded from the list above. Sharp will not rasterise it, and
SVG can carry script, so serving tenant-uploaded SVG from a niblr.store subdomain is an
XSS vector. If merchants need SVG logos, add it as a separate sanitised path (strip
`<script>`, event handlers and external references on ingest) rather than adding the
mime type here.

**On height.** Every size sets width only, so aspect ratio is preserved and portrait
product shots are not cropped. Do not add `height` without a deliberate crop decision.

**Object count.** This produces four objects per upload (the processed main file plus
three sizes). Each is a Class A write. That is the right trade against delivery size,
but if the write-op count becomes a problem, drop `hero` first.

**Acceptance:**
- A 4 MB JPEG upload results in a stored main file under ~300 KB, in WebP.
- `doc.sizes.thumb`, `doc.sizes.card` and `doc.sizes.hero` all exist with URLs and widths.
- A `.html` or `.zip` upload is rejected.
- A 20 MB image is accepted; a 30 MB one is rejected with a clear message.
- Existing tests still pass. Add a test asserting the mime allowlist rejects `text/html`.

---

## Task 2 — Meter what is actually stored — **Shipped 26 Jul 2026**

**File:** `src/lib/plan-enforcement.ts`, `src/collections/Media.ts`

The quota currently counts the wrong number twice over.

`Media.ts` `beforeChange` calls `assertStorageQuota` with `req.file?.size`, the
**incoming upload**. `afterChange` then adds `doc.filesize`, the **main stored file**.
Once Task 1 lands, neither equals what the bucket holds, because the bucket holds the
processed main file plus every size.

Fix:

1. Add a helper, `totalStoredBytes(doc)`, returning `doc.filesize` plus the sum of
   `doc.sizes[*].filesize` for every generated size. Put it beside the collection so
   both hooks use one implementation.
2. `afterChange` adjusts `mediaBytesUsed` by `totalStoredBytes`, not `doc.filesize`.
   Same for the update delta and for `afterDelete`.
3. `beforeChange` cannot know the processed size yet, since sharp has not run. Keep
   using the incoming upload size there as a **conservative pre-check** and say so in a
   comment: it over-estimates, which fails safe. Reconcile to the true figure in
   `afterChange`.

**Acceptance:** upload one 4 MB image and confirm `tenant.mediaBytesUsed` increases by
the sum of the four stored objects, not by 4 MB and not by the main file alone. Delete
it and confirm the counter returns to its previous value exactly.

---

## Task 3 — Reconcile `mediaBytesUsed` — **Shipped 26 Jul 2026**

**File:** `src/lib/media-usage.ts` plus `scripts/recompute-usage.ts`

> A reconcile script already existed and was NOT new — and it summed `filesize`
> alone, so after Task 1 running it would have reintroduced the ~65% undercount
> the hooks had just been fixed for. It now shares `totalStoredBytes` with the
> hooks and takes an optional tenant and `--dry-run`.

`mediaBytesUsed` is a running counter mutated by hooks on the tenant record. Any failed
upload, hook error, out-of-band deletion, or direct bucket change desyncs it
permanently, and nothing recomputes it. It is about to become the basis of a commercial
gate, so it needs to be verifiable.

Add `recomputeTenantMediaBytes(payload, tenantId)` that sums `totalStoredBytes` across
every media doc for the tenant and writes the result. Expose it as a script that can
run for one tenant or all. Run it after the Task 5 backfill.

**Acceptance:** running it against a tenant whose counter has been manually corrupted
restores the correct value. Unit test with a mocked payload.

---

## Task 4 — Serve the right size — **Shipped 26 Jul 2026**

**New file:** `src/lib/image.ts`

Do **not** reach for `next/image` here. Two reasons. Vercel bills for image
optimization transformations, and you would be paying it to redo work sharp already did
at upload time. And `next/image` optimization behaves differently outside Vercel, so
the open-source single-store build would serve images differently from the hosted one.
Same codebase, different behaviour, is the divergence this project avoids everywhere else.

Instead, build a `srcset` from the sizes Payload already generated.

```ts
/** Build a srcset from a Payload media doc's generated sizes. */
export function mediaSrcSet(media): string | undefined
/** The largest available URL, for the src fallback. */
export function mediaSrc(media): string | undefined
```

Requirements:

- Emit `${url} ${width}w` per available size, plus the main file at its own width.
- Return `undefined` when the doc has no `sizes` (media uploaded before this change, or
  a GIF that sharp passed through). Call sites must degrade to a plain `src`, never render
  a broken image.
- Handle both a populated media object and an id, since blocks vary in depth.
- Pure and unit-tested. No Payload imports.

Then update all 18 render sites. Each needs a `sizes` attribute matching its layout,
which is the part that cannot be automated:

| File | Sites | Suggested `sizes` |
|---|---|---|
| `blocks/MediaHero/Component.tsx` | 1 | `100vw` |
| `blocks/SplitHero/Component.tsx` | 2 | `(min-width: 768px) 50vw, 100vw` |
| `blocks/PromoSection/Component.tsx` | 2 | `(min-width: 768px) 50vw, 100vw` |
| `blocks/StoryStats/Component.tsx` | 1 | `100vw` |
| `blocks/CategoryPreviews/Component.tsx` | 3 | `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` |
| `blocks/FeaturedProduct/Component.tsx` | 1 | `(min-width: 768px) 50vw, 100vw` |
| `blocks/ImageGallery/Component.tsx` | 1 | `(min-width: 640px) 50vw, 100vw` |
| `blocks/LogoStrip/Component.tsx` | 1 | `200px` |
| `blocks/VideoEmbed/Component.tsx` | 1 (poster) | `100vw` |
| `(storefront)/store/[tenant]/products/[slug]/page.tsx` | 2 | `(min-width: 1024px) 50vw, 100vw` |
| `(storefront)/store/[tenant]/components/ProductCard.tsx` | 1 | `(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw` |
| `(storefront)/store/[tenant]/components/cart/CartDrawer.tsx` | 1 | `96px` |
| `(storefront)/store/[tenant]/components/Header.tsx` | 1 (logo) | `200px` |

**Do not touch `src/components/analytics/PixelScripts.tsx`.** Its two `<img>` tags are
1×1 tracking pixels and must stay exactly as they are.

Also add `width` and `height` attributes where the aspect ratio is known, or an explicit
CSS aspect-ratio box. Every one of these currently ships without intrinsic dimensions,
which causes layout shift on load. Fixing it alongside is nearly free and it is a real
Core Web Vitals problem on the storefronts.

**Acceptance:** view a product page on a throttled mobile viewport and confirm the
browser requests `thumb` or `card`, not the 2000px main file. No layout shift on image
load. Media uploaded before this change still renders.

---

## Task 5 — Backfill existing media — **Shipped and RUN in production, 26 Jul 2026**

> **Run it AFTER a deploy, and redeploy immediately after it finishes.**
>
> The backfill changes filenames (`x.png` becomes `x.webp`). Storefront HTML is
> cached, and the `revalidateMediaHook` fires inside the *script's* process, which
> cannot invalidate the running production app's cache. So between the backfill
> finishing and the next deploy, production served cached HTML pointing at
> filenames that no longer exist — every product image 403'd on the live store
> until a redeploy regenerated the pages.
>
> This happened. It was caught and fixed within minutes by `vercel redeploy`, but
> it is not obvious from the spec and it will happen again to anyone who runs this
> without the follow-up. Treat the redeploy as part of the procedure, not cleanup.
>
> **Actual run:** 37 of 50 reprocessed. Storage for those docs 79.1 MB -> 20.0 MB;
> the sdbakery counter fell 86.1 MB -> 24.1 MB. `recompute:usage` afterwards
> reported **zero drift**, so the Task 2 hooks tracked 37 file replacements exactly.
>
> The 13 failures were all on the seeded demo tenants (`store-a`, `store-b`) whose
> objects are **0-byte files in the bucket** — pre-existing broken fixtures the
> backfill surfaced rather than caused.
>
> **Left behind, then cleaned up:** a full bucket-vs-database audit found **16**
> unreferenced objects (11.0 MB) — four real originals plus twelve 0-byte demo
> files. All deleted 26 Jul 2026 via `pnpm audit:media --delete-orphans`; a
> re-audit reports zero orphans. Whether the four predate the backfill could not be
> established, because the bucket was not snapshotted beforehand; the DB was.
> Snapshot both next time. Re-upload deletion was separately verified to work on
> S3, not just on local disk.
>
> **13 rows still point at objects that do not exist** — all on the seeded demo
> tenants `store-a` and `store-b`, whose rows say `fashion-backpack.jpg` while the
> bucket held a 0-byte `fashion-backpack-1.jpg`. Broken in both directions, from
> the seed, long before any of this work. `pnpm audit:media` reports them under
> MISSING; fixing them means re-running the seed, not re-running the backfill.

Adding `imageSizes` only affects **new** uploads. Every image already in the bucket
stays a raw original with no variants, so every existing storefront keeps serving
full-resolution files until this runs.

Write a script under `scripts/` that, for each media doc:

1. Fetches the current file from storage.
2. Re-runs it through Payload so sharp reprocesses and generates sizes. `payload.update`
   with the file attached is the most reliable path; verify against Payload 3 docs.
3. Skips docs that already have `sizes`, so the script is idempotent and re-runnable.
4. Batches with a concurrency limit and logs progress. Expect Class A write ops to spike;
   this is a one-off.

Then run `recomputeTenantMediaBytes` for every tenant, since filesizes will have changed
substantially.

`pnpm audit:media` closes the gap `recompute:usage` cannot: it reconciles the BUCKET
against the DATABASE, reporting objects nothing references and rows pointing at
nothing. `recompute:usage` only proves the counter matches the rows.

**Delete-old-object behaviour: CONFIRMED, 26 Jul 2026.** Re-uploading through
`payload.update` removes the previous objects rather than orphaning them — probed on
local disk: 4 files before, the same 4 replaced after, none left behind. So storage
goes down, not up. The spec's central worry does not materialise.

There is no staging environment. Instead the write path was rehearsed for real
against a planted pre-processing doc on local disk: it became WebP with all three
variants, the original was removed, and a re-run correctly skipped it.

Two things the spec did not anticipate:

- **The mime allowlist blocks re-upload of types it no longer accepts.** Production
  holds an SVG store logo and a webm, both uploaded before Task 1. Reprocessing
  either would throw mid-run, so they are skipped and left exactly as they are.
- **Filenames can change** (`x.png` becomes `x.webp`; a same-extension collision
  becomes `x-1.ext`). Harmless — URLs derive from the doc — but CDN-cached copies of
  the old URLs become orphaned entries that expire on their own.

**Acceptance:** after the backfill, every media doc has `sizes`, storefronts serve
variants, and each tenant's `mediaBytesUsed` matches a fresh recount.

---

## Task 6 — Stop hosting video — **Shipped 26 Jul 2026**

> **What the data actually showed.** Production has **zero** VideoEmbed blocks,
> published or draft, so the migration had nothing to convert here — it is written
> for self-host installs. The one uploaded video (`SD Bakery`, webm) is referenced
> by a **MediaHero draft**, not a VideoEmbed.
>
> `MediaHero` also accepts video, which this task does not cover. It is left alone
> deliberately: its use is a muted background loop, which is the scoped exception
> this spec already sanctions, and since the Task 1 mime allowlist blocks video
> uploads outright, **no new video can enter the system by any route**. That branch
> now only renders the one legacy draft.
>
> **Migration decision:** a `provider: 'file'` block becomes `provider: 'youtube'`
> with a null url, so `normalizeEmbedUrl` returns nothing and the component falls
> through to its poster-image branch — a still frame, not a dead player. The
> uploaded video is unlinked, never deleted; the media doc survives so a merchant
> can download it and re-host. Proven by rolling the migration back, planting a
> file-provider block with a poster, and migrating forward: provider converted,
> url nulled, poster preserved.

**Files:** `src/blocks/VideoEmbed/config.ts`, `src/blocks/VideoEmbed/Component.tsx`

`VideoEmbed` offers YouTube, Vimeo and "Uploaded file". Remove the uploaded-file option.

Self-hosting video means no transcoding, no adaptive bitrate and no poster generation. A
merchant uploads a 1080p MP4 and a shopper on a slow connection gets a stalling player.
YouTube and Vimeo do transcoding, adaptive streaming and global CDN for free, and better.
Video files are also the single fastest way for one tenant to exhaust a storage tier.

- Remove `file` from the `provider` options and remove the `file` upload field.
- Write a migration for existing blocks using `provider: 'file'`. Do not silently break
  a live page: either convert to a poster image, or leave the block rendering the poster
  with the video omitted. Decide, then state it in the migration comment.
- Keep the poster-image `<img>` path; it is a normal image and gets the Task 4 treatment.

If this is overruled and uploaded video stays, then scope it explicitly: muted background
loops only, a 20 MB ceiling, `video/mp4` and `video/webm` only, and a field description
saying so.

---

## Verification

```
npx tsc --noEmit
npx vitest run
```

Then by hand, on a staging storefront:

1. Upload a 4 MB phone photo. Confirm the stored main file is WebP and under ~300 KB.
2. Attempt a `.html` upload. Confirm rejection.
3. Load a product listing on a 400px viewport with throttling. Confirm the network tab
   shows `thumb` or `card` requests, not the main file.
4. Confirm no layout shift as images load.
5. Corrupt a tenant's `mediaBytesUsed`, run the recompute script, confirm it is restored.
6. Confirm a pre-backfill media doc still renders.

Update `ROADMAP.md` in the same commits. Add rows for the ingest pipeline, the serving
layer and the backfill, and mark them Shipped as they land.

---

## What this unblocks

Once ingest is processing images, storage caps can be set generously enough to be
guardrails rather than product limits, which is the precondition for the plan-tier work:
unlimited products on every paid tier, orders never counted, and storage set high enough
that no honest merchant ever meets it. Do not set the new caps until Task 5 has run and
you can see real post-processing usage per tenant.
