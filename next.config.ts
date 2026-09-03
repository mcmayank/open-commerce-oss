import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
import { scopeClientHintsToAdmin } from './src/lib/client-hint-headers'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // Local dev uses lvh.me (and *.lvh.me subdomains, which resolve to 127.0.0.1)
  // to exercise per-tenant hostname routing. Next.js 16 blocks dev asset/HMR
  // requests from hosts other than the one the server binds to, which leaves
  // the client-heavy admin panel blank. Allow the dev hosts here.
  // Not used in production — real domains serve their assets same-origin.
  allowedDevOrigins: ['lvh.me', '*.lvh.me'],
  /**
   * app/global-not-found.tsx is still flag-gated in Next 16. It is the ONLY
   * boundary that fires for storefront 404s: the host proxy rewrites
   * `shop.example` → `/store/<slug>/…`, and notFound() resolves boundaries
   * against the ORIGINAL request path, which matches no route tree — so
   * segment not-found.tsx files never apply and Next's unbranded default
   * rendered instead. See src/app/global-not-found.tsx.
   */
  experimental: {
    globalNotFound: true,
  },
  /**
   * Long-lived caching for storefront media.
   *
   * Next's default for a dynamic route is `public, max-age=0, must-revalidate`,
   * which meant every image request — from every visitor, on every page view —
   * was a serverless invocation with full egress. Measured on production before
   * this: `x-vercel-cache: MISS` on three consecutive requests for the same
   * 2.2 MB file.
   *
   * Safe to cache immutably because these URLs are content-addressed in practice:
   * replacing a file on an existing doc produces a NEW filename (verified —
   * `probe-image.webp` became `probe-image-1.webp`), so a given URL never serves
   * different bytes.
   *
   * Safe to cache PUBLICLY because every response here is identical regardless of
   * who asks. `mediaReadAccess` only diverges by auth for `application/pdf`, and
   * `Media.upload.mimeTypes` is image-only — `Media.test.ts` pins that, because if
   * a non-image type is ever re-admitted this cache would replay an authenticated
   * 200 to anonymous visitors and defeat the access control entirely.
   *
   * `/api/invoices/file/**` is deliberately NOT matched. Invoices are private.
   */
  async headers() {
    return [
      {
        source: '/api/media/file/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
  // /v2 was the staged landing page; it's now promoted to serve `/` directly
  // (src/app/(landing-v2)/). Permanent redirect so old links/bookmarks land home.
  async redirects() {
    return [
      {
        source: '/v2',
        destination: '/',
        permanent: true,
      },
    ]
  },
  images: {
    // AVIF first: ~30% smaller than WebP for the photographic landing imagery
    // (the hero is the LCP element on every mobile audit). Both are cached by
    // the optimizer after the first hit, so the extra encode cost is one-off.
    formats: ['image/avif', 'image/webp'],
    // Next 16 rejects any `quality` prop not listed here. 60 is what the
    // above-the-fold hero uses (src/app/(landing-v2)/sections/V2Hero.tsx);
    // everything else stays on the default 75.
    qualities: [60, 75],
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
      {
        // Static premium-theme assets (hero/story/visit imagery).
        pathname: '/themes/**',
      },
      {
        // Captured storefront screenshots (tests/shots/storefronts.shots.ts, via `pnpm shots`).
        pathname: '/shots/**',
      },
      {
        // Landing-page hero imagery (src/app/(landing-v2)/stores.ts).
        pathname: '/landing-v2/**',
      },
    ],
  },
  /**
   * The seed route reads pack images via a computed path.join, which Next's
   * bundler cannot trace. Without this they are absent from the deployed
   * function and seeding fails in production while working on a laptop.
   */
  outputFileTracingIncludes: {
    '/api/samples/seed': ['./src/packs/**/images/**'],
    // Bolton TTFs for the blog OG card (read via node:fs — see
    // opengraph-image.tsx for why fetch(new URL(...)) doesn't work here).
    '/blog/**': ['./src/fonts/*.ttf'],
  },
  // The `build` script pins `next build --webpack`: Payload documents Turbopack
  // for `next dev` only, and webpack is its recommended production bundler. This
  // webpack resolver customization (extensionAlias) is what Payload's ESM `.js`
  // imports rely on to resolve to `.ts/.tsx` source.
  //
  // `dev` and `devsafe` pin `--webpack` too, as of 9 Aug 2026. Next 16 defaults
  // `next dev` to Turbopack, and under it the nested `group` fields inside the
  // admin's tabs render no children at all — the Branding tab comes up empty, so
  // colours, fonts and radius are simply unreachable locally. That cost most of
  // a session to diagnose, and the conclusion drawn at the time was a
  // non-existent Payload bug rather than the bundler. dcd02a1 had already fixed
  // this class of failure for `build` and stopped there.
  //
  // The cost is a slower dev server. Worth it: the alternative is an admin that
  // silently renders less than it should, which is far more expensive to debug
  // than it is to wait for. `.claude/launch.json` deliberately does NOT repeat
  // the flag — it invokes `pnpm run dev`, which now carries it.
  //
  // The `build` script also runs `payload generate:importmap` FIRST, so the
  // admin importMap always matches the plugins active in THIS environment. That
  // matters because the s3Storage plugin is conditional on `S3_BUCKET` (see
  // payload.config.ts): on Vercel S3_BUCKET is set, so the admin needs the
  // S3ClientUploadHandler client component — and a stale importMap generated
  // without it makes the admin panel render blank (getFromImportMap: not found).
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

const payloadConfig = withPayload(nextConfig, { devBundleServerPackages: false })

/**
 * withPayload() appends a `/:path*` rule demanding the colour-scheme client
 * hint (`Critical-CH`) for the admin's dark mode. On public pages that header
 * forces every first-time browser to retry its first request, which Lighthouse
 * measured as a 600 ms self-redirect ahead of the homepage. Scope it to /admin.
 * See src/lib/client-hint-headers.ts.
 */
export default {
  ...payloadConfig,
  async headers() {
    const rules = payloadConfig.headers ? await payloadConfig.headers() : []
    return scopeClientHintsToAdmin(rules)
  },
} satisfies NextConfig
