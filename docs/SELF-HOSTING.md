# Self-Hosting Guide (non-Vercel)

This guide covers deploying the Open Commerce Platform on your own infrastructure — a VPS, Docker host, bare-metal server, or any cloud provider that is not Vercel.

---

## Overview

The app is a standard Next.js application backed by PostgreSQL (via Payload CMS) and optionally an S3-compatible object store. Any Linux host that can run Node 20+ can run it. The main things to handle manually are:

1. Wildcard DNS for tenant subdomains.
2. A reverse proxy to terminate TLS and forward traffic.
3. Database migrations before first start.
4. Replacing Vercel-specific features (cron, auto domain attach).

---

## The single-store build

The open-source build (exported by `pnpm oss:export` from the private repo, and
what the public repo contains) runs exactly one store. There is no flag to set
and nothing to switch off: subdomains, signup, billing, plan limits, custom-domain
verification and the platform admin do not exist in that tree.

```bash
DATABASE_URL=postgresql://user:password@host:5432/niblr
PAYLOAD_SECRET=a-long-random-string
NEXT_PUBLIC_ROOT_DOMAIN=shop.example.com     # the host your store is served on
```

Run `pnpm payload migrate` once, start the app, and open `/admin` to create the
first user. Your storefront is served at `/` on whatever host you point at the
app, the admin at `/admin`. Point DNS straight at your deployment: a single
A/CNAME record is enough, and the wildcard DNS, reverse-proxy `server_name`
wildcarding and custom-domain sections below do not apply.

---

## Wildcard DNS + Reverse Proxy

### DNS

At your domain registrar, add:

```
A    yourdomain.com        → <your-server-IP>
A    *.yourdomain.com      → <your-server-IP>
```

or equivalently with a CNAME for the wildcard if your registrar supports it. Wildcard DNS is required so that `store-a.yourdomain.com`, `store-b.yourdomain.com`, etc. all reach your server.

### Reverse proxy (nginx example)

The Next.js process listens on a local port (default 3000). nginx (or Caddy) sits in front and:

- Terminates TLS (Let's Encrypt wildcard cert).
- Forwards all traffic — both subdomain requests and custom-domain requests — to the Next.js process.

**nginx config snippet:**

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com *.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
    }
}
```

> **Important:** Set `proxy_set_header Host $host` so the Next.js app receives the original hostname. `proxy.ts` reads the `Host` header to decide whether to route as a tenant subdomain, a custom domain, or the platform.

**Wildcard TLS with Certbot:**

```bash
certbot certonly --dns-<your-dns-provider> \
  -d yourdomain.com \
  -d "*.yourdomain.com"
```

Replace `--dns-<your-dns-provider>` with your DNS provider's certbot plugin (e.g. `--dns-cloudflare`, `--dns-route53`). DNS challenge is required for wildcard certs.

**Caddy alternative (automatic HTTPS):**

```caddy
*.yourdomain.com yourdomain.com {
    reverse_proxy localhost:3000
    tls {
        dns <provider> {
            # provider-specific credentials
        }
    }
}
```

---

## Custom Domains (manual DNS adapter)

Without `VERCEL_API_TOKEN`, the app uses the manual domain adapter (`src/lib/domains/manual.ts`). When a merchant adds a domain in the admin:

1. The adapter returns CNAME and TXT records for the merchant to add at their registrar:
   ```
   CNAME  shop.merchant.com     →  yourdomain.com
   TXT    _verify.shop.merchant.com  →  open-commerce-verify
   ```
2. The domain status stays `pending`.
3. A **super-admin** must log in to the admin panel and flip `status` to `verified` after confirming the DNS records are in place.
4. Once verified, `proxy.ts` resolves `shop.merchant.com` → tenant slug and serves the store.

Your reverse proxy must forward custom-domain requests to the same Next.js process. With the nginx config above (no `server_name` filter), this works automatically.

> **No automatic DNS verification polling** in the manual adapter. If you want automated verification, implement a scheduled job that calls `GET /api/domains/verify?host=<hostname>` and updates the row status, or super-admin verifies manually.

---

## Media: Local Disk vs. S3

### Local disk (default)

Without `S3_*` env vars, Payload stores uploads at `./media` relative to the Next.js process. Fine for development; on production servers make sure this path is on a persistent volume (not a container's ephemeral layer).

### S3-compatible object store

Set all five `S3_*` env vars to switch to `@payloadcms/storage-s3`:

| Variable | Example |
|---|---|
| `S3_ENDPOINT` | `https://s3.yourdomain.com` or `https://<ref>.supabase.co/storage/v1/s3` |
| `S3_REGION` | `auto` (Supabase, Cloudflare R2) or `us-east-1` (AWS) |
| `S3_BUCKET` | `media` |
| `S3_ACCESS_KEY_ID` | Your S3 key ID |
| `S3_SECRET_ACCESS_KEY` | Your S3 secret |

Any S3-compatible provider works: AWS S3, Cloudflare R2, MinIO, Supabase Storage, Backblaze B2.

---

## Environment Variable Reference

### Core (required)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Use a transaction pooler (port 6543) if running Supabase. |
| `PAYLOAD_SECRET` | Random 32-byte hex string. Signs JWT sessions. |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Your apex domain (e.g. `yourdomain.com`). Drives subdomain routing in `proxy.ts`. |
| `CREDENTIALS_ENCRYPTION_KEY` | Random 32-byte hex string. AES-256-GCM key for gateway secrets and HMAC tokens. |

Generate random secrets:

```bash
openssl rand -hex 32
```

### Storage / S3 (optional — enables cloud media)

| Variable | Description |
|---|---|
| `S3_ENDPOINT` | S3-compatible endpoint URL. |
| `S3_REGION` | Region (use `auto` for Supabase/R2). |
| `S3_BUCKET` | Bucket name. |
| `S3_ACCESS_KEY_ID` | Access key. |
| `S3_SECRET_ACCESS_KEY` | Secret key. |

### Email (optional — enables transactional email)

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Platform Resend API key for order confirmations and system emails. |
| `RESEND_FROM_EMAIL` | Verified sender address (e.g. `noreply@yourdomain.com`). |

### Cron (optional — enables marketing campaign delivery)

| Variable | Description |
|---|---|
| `CRON_SECRET` | Auth token for `POST /api/marketing/process`. |

### Custom domains / Vercel-specific (optional)

| Variable | Description |
|---|---|
| `VERCEL_API_TOKEN` | Vercel API token. Only needed if deploying on Vercel and want auto domain attachment. Not needed for self-hosting. |
| `VERCEL_PROJECT_ID` | Vercel project ID. Required when `VERCEL_API_TOKEN` is set. |

---

## Vercel-First Features and Self-Host Replacements

| Feature | Vercel behaviour | Self-host equivalent |
|---|---|---|
| **Auto domain attach** | Setting `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` registers custom domains with the Vercel project via API on creation. | Use the manual adapter (no env vars needed). Super-admin marks domains verified after the merchant sets DNS records. |
| **Cron auth injection** | On Pro/Enterprise, Vercel injects `Authorization: Bearer $CRON_SECRET` automatically on every cron invocation. | Set up your own cron (system crontab, `cron` container, etc.) that hits the endpoint: `curl -X POST -H "x-cron-secret: <CRON_SECRET>" https://yourdomain.com/api/marketing/process`. Every-minute schedule recommended. |
| **Wildcard TLS** | Vercel provisions and renews wildcard certs automatically. | Use Certbot with a DNS challenge plugin (`--dns-cloudflare`, `--dns-route53`, etc.) for `*.yourdomain.com`. Auto-renewal via certbot timer. |
| **Serverless scaling** | Vercel scales Next.js functions automatically. | Use a Node process manager (PM2, systemd) or containerise with Docker. |

---

## Running the App

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run migrations (once, before first start — and after each deploy with new migrations)
DATABASE_URL=<url> PAYLOAD_SECRET=<secret> pnpm payload migrate

# Start in production mode
pnpm start
```

With PM2:

```bash
pm2 start "pnpm start" --name ecommerce
pm2 save
pm2 startup
```

### Docker

A `Dockerfile` is included. Build and run:

```bash
docker build -t ecommerce .
docker run -p 3000:3000 \
  -e DATABASE_URL=... \
  -e PAYLOAD_SECRET=... \
  -e NEXT_PUBLIC_ROOT_DOMAIN=yourdomain.com \
  -e CREDENTIALS_ENCRYPTION_KEY=... \
  ecommerce
```

Run migrations before starting the container the first time:

```bash
docker run --rm \
  -e DATABASE_URL=... \
  -e PAYLOAD_SECRET=... \
  ecommerce \
  pnpm payload migrate
```

---

## Seed Demo Data

```bash
pnpm seed
```

Idempotent — safe to run multiple times. Creates:
- Super-admin: `admin@platform.local` / `changeme-super-1`
- Store A owner: `owner@store-a.local` / `changeme-a-1`
- Store B owner: `owner@store-b.local` / `changeme-b-1`

> **Change all passwords before going live.**

---

## Troubleshooting

**Custom-domain requests return the platform homepage instead of the tenant store.**
- Confirm the domain's `status` is `verified` in the Payload admin.
- Confirm your reverse proxy passes the `Host` header unchanged (`proxy_set_header Host $host`).
- The domain-cache TTL is 60 seconds — wait a moment after marking a domain verified.

**Media uploads fail or images do not load after deploy.**
- If using S3, verify all five `S3_*` vars are set and the bucket is accessible.
- If using local disk, confirm the `./media` directory exists and the process has write permissions.

**Marketing cron never fires.**
- Confirm `CRON_SECRET` is set and your cron job is running.
- Test the endpoint manually: `curl -X POST -H "x-cron-secret: <value>" http://localhost:3000/api/marketing/process`.

## How the public repo is produced

The open-source single-store build is an export of the private repo, not a
fork: `oss/export.mjs` copies the tracked tree, deletes every path in
`oss/manifest.json` (the hosted overlay under `src/hosted/`, the marketing site,
billing, custom domains, the voice assistant, demo tooling), swaps the overlay
seams for their identity twins in `oss/overrides/`, prunes hosted-only
dependencies, and runs `oss/leak-scan.mjs` against a denylist of hosted
identifiers. `.github/workflows/export-oss.yml` runs that on every release tag
and pushes the result to the public repo as one squashed commit. The design is
in `docs/superpowers/specs/2026-09-02-oss-single-tenant-export-design.md`.
