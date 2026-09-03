# Deploying to Vercel — Production Runbook

This guide walks through a full production deploy of the Open Commerce Platform on Vercel with Supabase as the database and object storage backend.

---

## Prerequisites

### 1. Supabase project

1. Create a project at <https://supabase.com> (free tier works).
2. In **Project Settings → Database → Connection string**, select **Transaction pooler** and copy the connection string. It ends with `:6543/postgres`. This is your `DATABASE_URL`.
3. Keep the project dashboard open — you will return for S3 credentials (step below).

### 2. Generate secrets

Run these locally (or in any shell with `openssl`):

```bash
# Payload session secret — keep this private; rotation logs everyone out
openssl rand -hex 32   # → PAYLOAD_SECRET

# Encryption key for gateway secrets and unsubscribe tokens
openssl rand -hex 32   # → CREDENTIALS_ENCRYPTION_KEY

# Cron auth token — protects /api/marketing/process
openssl rand -hex 32   # → CRON_SECRET
```

### 3. Provision Supabase Storage S3 credentials

Supabase Storage exposes an S3-compatible API. To switch media uploads from local disk to Supabase Storage:

1. In your Supabase dashboard go to **Storage → S3 Connection**.
2. Click **Generate new credentials** → copy the **Access Key ID** and **Secret Access Key**.
3. Note your project reference ID (visible in the URL `app.supabase.com/project/<ref>`).
4. The S3 endpoint URL is `https://<ref>.supabase.co/storage/v1/s3`.
5. Create a bucket (e.g. `media`) and make it **public** if you want direct media URLs.

> **Without `S3_*` vars:** media falls back to local disk. On Vercel's ephemeral filesystem this means media does not persist across deploys. Always set S3 vars in production.

---

## Import the Repository into Vercel

1. Go to <https://vercel.com/new>.
2. Select your Git provider, find this repository, and click **Import**.
3. Vercel auto-detects Next.js — leave the **Framework Preset** as Next.js.
4. Do **not** add a build command override at this step (migrations run separately — see below).
5. Click **Deploy** — the first build will succeed and give you a preview URL. Configure env vars next.

---

## Environment Variables

In **Vercel → Project → Settings → Environment Variables**, add each variable below. Vercel scopes every variable **per environment** — a value saved under Production is not automatically available to Preview or Development. Tick all three scopes (or add the variable a second time under Preview) for anything the build needs.

> **`DATABASE_URL` must be set for every environment, including Preview.** `payload.config.ts` builds its Postgres adapter at config-construction time, and that runs during `payload generate:importmap` in `pnpm build` — before any request is served. If `DATABASE_URL` is missing, the build now fails immediately with a clear error naming the variable, instead of silently defaulting to `127.0.0.1:5432` and failing later, cryptically, mid-prerender. Point Preview at its **own** Supabase project/branch, not Production's: a PR that includes a migration will prerender against whatever schema Preview's database currently has, and running it against Production's schema before the migration lands is exactly backwards.

**What this project actually uses (set 4 Aug 2026).** Preview's `DATABASE_URL`
points at the **`niblr staging`** Supabase project (`blpfcynopfieuxtpixof`),
not Production (`ciqsazvrwzsojtkwxnyt`). Until that was set, *every* Preview
build failed on the guard above, so every PR showed a red Vercel ✗ that had to
be mentally discounted — which is exactly how a real failure gets missed.

Two things that follow from it:

- **Staging needs migrating too.** It was 18 migrations behind when it was
  wired up. A PR that adds a migration prerenders against whatever schema
  staging has, so run `DATABASE_URL=<staging> pnpm exec payload migrate`
  when you ship one, the same as Production.
- **Staging pauses.** It is on a plan that pauses after inactivity, and a
  paused database fails Preview builds exactly like a missing one. If Preview
  starts failing again, check whether the project is paused before assuming
  the variable is gone.

Only `DATABASE_URL` is required for the *build*. The other Production-only
variables (`S3_*`, `CREDENTIALS_ENCRYPTION_KEY`, `CRON_SECRET`,
`NEXT_PUBLIC_ROOT_DOMAIN`) are read at request time, so a Preview renders
without them — media uploads and cron simply do not work there. Deliberately:
sharing the production bucket with Preview is the same mistake `#93` fixed for
local development.

### Core

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase transaction-pooler connection string (port **6543**). Required for all Payload DB operations, in every Vercel environment (Production, Preview, Development) — see the callout above. |
| `PAYLOAD_SECRET` | Random 32-byte hex secret. Signs JWT sessions. Rotation logs all users out. |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Your apex domain, e.g. `yourdomain.com`. Used by `proxy.ts` to distinguish tenant subdomains from custom hosts. |
| `CREDENTIALS_ENCRYPTION_KEY` | Random 32-byte hex key. AES-256-GCM encryption for gateway secrets (Stripe/Razorpay keys) and HMAC unsubscribe tokens. **Losing this orphans all stored payment credentials** — there is no re-encryption path. |

### Storage / S3

| Variable | Purpose |
|---|---|
| `S3_ENDPOINT` | S3-compatible endpoint URL, e.g. `https://<ref>.supabase.co/storage/v1/s3`. |
| `S3_REGION` | Region string. For Supabase Storage use `auto`. For AWS use e.g. `us-east-1`. |
| `S3_BUCKET` | Bucket name (e.g. `media`). Must already exist in Supabase Storage. |
| `S3_ACCESS_KEY_ID` | S3 access key generated in Supabase Storage → S3 Connection. |
| `S3_SECRET_ACCESS_KEY` | S3 secret key generated in Supabase Storage → S3 Connection. |

When all five `S3_*` vars are set, `payload.config.ts` switches the media adapter from local disk to `@payloadcms/storage-s3`. Unset any one of them and the build falls back to local disk (useful for preview branches without S3).

## Object storage — Cloudflare R2 (recommended)

Media uses the S3 adapter (`payload.config.ts`, gated on `S3_BUCKET`). R2 is S3-compatible and `forcePathStyle` is already set, so no code change is needed.

1. Cloudflare → R2 → create a bucket (e.g. `open-commerce-media`) and an API token (Access Key ID + Secret).
2. Set these env vars in Vercel (Production) **and** local `.env`:
   - `S3_BUCKET=open-commerce-media`
   - `S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`
   - `S3_REGION=auto`
   - `S3_ACCESS_KEY_ID=...`
   - `S3_SECRET_ACCESS_KEY=...`
3. Redeploy to activate the adapter. Media serves through Payload's `/api/media/file/…` route, so the bucket stays **private** — no public access or custom domain needed.
4. Re-upload existing media so the bytes land in R2. For SD Bakery: `pnpm reset:sdbakery && pnpm seed:sdbakery`. After a storage backend change, run `pnpm recompute:usage` to true up `mediaBytesUsed`.

### Email (transactional)

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Platform-level Resend API key. Used for order confirmation emails and other transactional messages originating from the platform (not tenant campaigns). |
| `RESEND_FROM_EMAIL` | Verified Resend sender address for platform emails (e.g. `noreply@yourdomain.com`). |

Tenant-level campaign emails use each tenant's own `resendApiKey` stored in **Marketing Configs** (encrypted at rest with `CREDENTIALS_ENCRYPTION_KEY`).

### Cron

| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Auth token for `POST /api/marketing/process`. Vercel injects it automatically as `Authorization: Bearer $CRON_SECRET` on every cron invocation (Pro/Enterprise only). Self-hosters pass it via `x-cron-secret` header. |

> **Vercel Hobby plan note:** Vercel does not inject the `Authorization` header on Hobby-plan crons. The endpoint silently returns 401 on every tick. Upgrade to Pro/Enterprise or trigger the endpoint manually with `-H "x-cron-secret: <value>"`.

### Custom Domains (optional)

| Variable | Purpose |
|---|---|
| `VERCEL_API_TOKEN` | Vercel personal/team API token. When set, adding a domain in the merchant admin automatically registers it with your Vercel project via the v10 domains API. Without it, the app falls back to the manual adapter and shows DNS records for the merchant to set themselves. |
| `VERCEL_PROJECT_ID` | The Vercel project ID (visible in **Project → Settings → General**). Required when `VERCEL_API_TOKEN` is set. |

---

## Run Database Migrations (Release Step)

> **Do NOT** run migrations inside the Next.js build command. Concurrent preview builds can race against the same database and cause migration conflicts. Run migrations as a dedicated release step or post-deploy hook.

### Option A — Vercel Release Command (recommended)

In **Vercel → Project → Settings → General → Build & Development Settings**, set:

- **Build Command:** `pnpm build` (default — leave as-is)
- **Install Command:** `pnpm install` (default)

Then add a **Release Command** (Vercel runs this once per deployment, after build, before traffic shifts):

```
pnpm payload migrate
```

The release command inherits all env vars, so it connects to the same `DATABASE_URL` as the running app.

### Option B — Run manually before first deploy

```bash
# From your local machine with the production DATABASE_URL set:
DATABASE_URL=<your-url> PAYLOAD_SECRET=<your-secret> pnpm payload migrate
```

Then push/deploy normally. On subsequent deploys that include new migrations, re-run this command (or promote Option A).

### Creating a migration — use `pnpm migrate:create`, not `payload migrate:create`

```bash
pnpm migrate:create <name>
```

Both generated artifacts in this repo — the admin import map and each migration's
schema snapshot — change content depending on whether `S3_BUCKET` is in the
generating process's environment, because `payload.config.ts` gates the whole
`s3Storage` plugin on that variable and the plugin contributes both an admin
component and a `prefix` field with a column default.

Neither `.env` nor `.env.local` carries `S3_BUCKET`, so generating locally with
the raw `payload` CLI is the *default* way to produce a corrupted artifact. The
failure is always a silent content change, never an error:

- A dropped `S3ClientUploadHandler` in `importMap.js` — this caused a blank
  admin in production once (`1b621c9`) and has drifted three more times since.
- A snapshot recording `invoices.prefix` without its `DEFAULT ''`, which puts a
  phantom `ALTER COLUMN "prefix" SET DEFAULT ''` into every later
  `migrate:create` diff. It reads exactly like a stale database default and is
  not one — **do not write a migration to drop it.** The databases are correct;
  restore the default in the newest snapshot instead.

`pnpm migrate:create` and `pnpm generate:importmap` default `S3_BUCKET` to a
placeholder when it is unset, so the plugin always loads during generation. The
value is never dialled — generation constructs the config and walks it without
opening a connection. Two CI workflows (`Import map`, `Migration snapshots`)
regenerate each artifact and fail on a mismatch; both were verified against a
planted violation rather than trusted for passing on a clean tree.

Do not remove these guards as redundant. They are the only thing standing
between a routine `migrate:create` and a silently corrupted committed file.

---

## Post-Migrate: Plan Tier Backfill (August 2026 release only)

> **Status on the hosted production database: DONE — 3 Aug 2026.** Migration
> applied 01:20 UTC, backfill applied 02:55 UTC; `sdbakery` and `store-b` moved
> `pro` → `growth`, leaving 7 `free` + 2 `growth` and zero `pro`. Nothing further
> is needed there. The procedure below still applies to **any other deployment**
> (self-host, staging, a restored snapshot) whose database predates this release,
> and the script is idempotent, so re-running it is harmless.

The `20260802_183348_add_plan_tiers` migration only widens the `tenants.plan`
enum with `starter` / `growth` / `agency` / `enterprise` — it does not move any
existing tenant off the retired `pro` value. That is a separate, explicit
operator step:

```bash
DATABASE_URL=<your-url> pnpm backfill:plans
```

**Run this once, immediately after the migration above, before relying on
per-tier entitlements in production.** If you skip it, every tenant still on
`pro` is silently treated as free-tier the moment anything reads the new
five-tier limits: premium blocks disappear **from their live storefront**,
products cap at 30 instead of 100, storage caps at 250 MB instead of 2 GB,
custom CSS and MCP writes stop working, and a tenant on a premium theme
**cannot save their store settings at all**, because the theme validator
re-checks the entitlement on every save.

Verify the backfill left no tenant on the old value:

```sql
SELECT plan, count(*) FROM tenants GROUP BY plan ORDER BY plan;
```

Expect **zero** rows with `plan = 'pro'`. Read this back from the database
itself, not from the script's own log line — the script reports what it
attempted, and if `DATABASE_URL` failed to override `.env.local` it will report
a cheerful success against your *local* database.

> **"Immediately" is not boilerplate — it was 95 minutes here, and that gap was
> live.** On 3 Aug 2026 the migration ran at 01:20 UTC and the backfill at 02:55.
> Because the five-tier code was already deployed, `asPlanId('pro')` resolved to
> `free` for the whole window, so SD Bakery's public storefront served free-tier
> limits the entire time. The enum widening is safe to run ahead of the deploy;
> the data move is not safe to leave behind it. Treat migrate → backfill → deploy
> as one release, not three chores.

---

## Configure Wildcard Subdomains

In **Vercel → Project → Settings → Domains**, add:

1. `yourdomain.com` (apex)
2. `*.yourdomain.com` (wildcard)

Follow Vercel's DNS instructions to point the records at Vercel. Vercel provisions wildcard TLS automatically. Each tenant at `{slug}.yourdomain.com` is routed by `proxy.ts` to the correct storefront.

> **Wildcard SSL note:** wildcard certificates cover one level of subdomains (e.g. `store-a.yourdomain.com`) but not deeper paths (e.g. `a.b.yourdomain.com`). Tenant slugs must not contain dots.

---

## Marketing Cron

The `vercel.json` already declares a cron schedule:

```json
{
  "crons": [{ "path": "/api/marketing/process", "schedule": "* * * * *" }]
}
```

For this to work:

- `CRON_SECRET` must be set in Vercel env vars.
- The Vercel project must be on **Pro or Enterprise** (Hobby does not inject the auth header).
- The `src/app/api/marketing/process/route.ts` function has `maxDuration: 60` already set in `vercel.json`.

---

## Custom Domain Auto-Attach

When `VERCEL_API_TOKEN` and `VERCEL_PROJECT_ID` are set:

- Adding a domain in the merchant admin calls `POST /api/domains` which triggers the Vercel adapter (`src/lib/domains/vercel.ts`).
- The adapter calls Vercel's `POST /v10/projects/{id}/domains` and returns verification DNS records.
- The domain status stays `pending` until a super-admin marks it `verified` (or a future DNS polling step does so automatically).

Without these two vars the manual adapter is used — the app still shows the DNS records the merchant must set, but no Vercel API call is made.

---

## Post-Deploy Checklist

- [ ] `pnpm seed` run once against production DB to create demo users (or create a super-admin via the Payload admin UI at `https://yourdomain.com/admin`).
- [ ] Wildcard domain shows in Vercel Domains with green SSL status.
- [ ] `curl -H "Host: <tenant-slug>.yourdomain.com" https://yourdomain.com/` rewrites to the tenant storefront.
- [ ] Platform admin (`https://yourdomain.com/admin`) accessible with super-admin credentials.
- [ ] A custom domain added by a tenant reaches `verified` after DNS setup.
- [ ] Change all seeded passwords before going live.
