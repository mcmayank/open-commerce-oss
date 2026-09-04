import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { s3Storage } from '@payloadcms/storage-s3'
import { resendAdapter } from '@payloadcms/email-resend'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import type { Config as PayloadConfig } from 'payload'
import { compose, gateMcpAccess } from './config-overlay'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { SectionDefinitions } from './collections/SectionDefinitions'
import { Categories } from './collections/Categories'
import { Products } from './collections/Products'
import { StoreSettings } from './collections/StoreSettings'
import { GatewayConfigs } from './collections/GatewayConfigs'
import { PaymentAttempts } from './collections/PaymentAttempts'
import { ProcessedWebhookEvents } from './collections/ProcessedWebhookEvents'
import { PaymentGatewayRequests } from './collections/PaymentGatewayRequests'
import { Customers } from './collections/Customers'
import { Orders } from './collections/Orders'
import { Invoices } from './collections/Invoices'
import { DiscountCodes } from './collections/DiscountCodes'
import { MarketingConfigs } from './collections/MarketingConfigs'
import { Contacts } from './collections/Contacts'
import { Campaigns } from './collections/Campaigns'
import { ImportJobs } from './collections/ImportJobs'
import { ImportItems } from './collections/ImportItems'
import { GiftCards } from './collections/GiftCards'
import { GiftCardTransactions } from './collections/GiftCardTransactions'
import { hardenMcpApiKeys } from './mcp/apiKeysAccess'
import { mcpCachePurge } from './mcp/mcpCachePurge'
import { listBlocksTool } from './mcp/listBlocksTool'
import { resolveDatabaseUrl } from './lib/migration-guard'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * The CORE config: one store, no tenancy, no billing, no platform admin.
 * `compose()` (src/config-overlay.ts) layers the hosted product on top in the
 * private repo; the OSS export replaces it with the identity. Hosted-only
 * pieces live in src/hosted/config.ts — never add them here.
 */
const coreConfig: PayloadConfig = {
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      providers: [
        '@/components/admin/PremiumEntitlement/PremiumEntitlementProvider#PremiumEntitlementProvider',
      ],
      // AdminNavClient (rendered by Nav below) now renders AdminNavExtras itself —
      // registering it again via afterNavLinks would render it twice.
      Nav: '@/components/admin/shell/AdminNav#AdminNav',
      header: ['@/components/admin/shell/AdminHeader#AdminHeader'],
      graphics: {
        Logo: '@/components/admin/brand/NiblrLogo#NiblrLogo',
        Icon: '@/components/admin/brand/NiblrIcon#NiblrIcon',
      },
      views: {
        paymentsSettings: {
          Component: '@/components/admin/payments-settings/PaymentsSettingsView#PaymentsSettingsView',
          path: '/settings/payments',
        },
        dashboard: {
          Component: '@/components/AdminHome#AdminHome',
        },
        importReview: {
          Component: '@/components/admin/imports/ImportReviewView#ImportReviewView',
          path: '/imports/:id',
        },
        // A ROOT view, deliberately: custom root views are matched after
        // Payload's built-in-route switch, so they render with no template and
        // no admin nav. That full-bleed viewport is the whole point — inside
        // the Document view the builder's storefront preview was squeezed to
        // ~600px on a laptop. See PageBuilderRoute for the provider stack it
        // has to hand-assemble as a result.
        pageBuilder: {
          Component: '@/components/admin/page-builder/PageBuilderRoute#PageBuilderRoute',
          path: '/pages/:id/builder',
        },
      },
    },
  },
  /**
   * Upload ceiling. Payload takes this globally, NOT per collection — there is
   * no `upload.limits` on a CollectionConfig — so it binds `media` and
   * `invoices` alike (invoices are ~3 KB, so it never binds there in practice).
   *
   * 25 MB is an abuse guard, not a compression lever: it exists so nobody
   * uploads a 2 GB TIFF. It must never be tight enough to reject a normal phone
   * photo. An upload failure during store setup is a churn event, and telling a
   * merchant to go compress their own images before using the product is not an
   * acceptable answer — that is what the ingest pipeline on `media` is for.
   *
   * `abortOnLimit` is what turns a silent truncation into an HTTP 413 the
   * merchant actually sees, and `responseOnLimit` is the message they get.
   */
  upload: {
    limits: { fileSize: 25 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: 'That file is larger than the 25 MB limit. Please upload a smaller image.',
  },
  // Nav section order follows the order each group is first seen here.
  // Merchant frequency, most-used first. See nav-groups.test.ts.
  collections: [
    // Orders
    Orders, Invoices,
    // Catalog
    Products, Categories, DiscountCodes, ImportJobs, GiftCards, GiftCardTransactions,
    // Customers
    Customers,
    // Marketing
    Campaigns, Contacts, MarketingConfigs,
    // Storefront
    Pages, Media, StoreSettings, SectionDefinitions,
    // Settings
    Users,
    // Hidden from nav
    ImportItems,
    // Platform / Payments internals (hidden from tenant nav)
    GatewayConfigs, PaymentAttempts, ProcessedWebhookEvents, PaymentGatewayRequests,
  ],
  globals: [],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: { connectionString: resolveDatabaseUrl() },
    push: false,
    migrationDir: './src/migrations',
  }),
  sharp,
  email: process.env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: process.env.RESEND_API_KEY,
        defaultFromAddress: 'noreply@mail.niblr.store',
        defaultFromName: 'Niblr',
      })
    : undefined,
  plugins: [
    // Registered UNCONDITIONALLY, and switched off rather than omitted when
    // there is no bucket. Gating the whole plugin on S3_BUCKET made two
    // committed generated artifacts depend on whether that variable happened to
    // be in the generating process's environment: importMap.js lost
    // S3ClientUploadHandler (a blank admin in production once — 1b621c9), and
    // migration snapshots lost invoices.prefix's column default, putting a
    // phantom SET DEFAULT into every later migrate:create diff.
    //
    // `enabled` reproduces the old RUNTIME behaviour precisely: with no bucket
    // the plugin does not take over storage, so local development keeps falling
    // back to disk. Registering it always is what stabilises importMap.js.
    //
    // DO NOT add `alwaysInsertFields: true` here. Its docs say it "ensures a
    // consistent schema across all environments" and it becomes the default in
    // Payload v4, so it reads like the obvious completion of this fix. Measured
    // 10 Aug 2026, it does the opposite in THIS config, because it only takes
    // effect when the plugin is DISABLED:
    //
    //   S3_BUCKET set   (enabled: true  — prod, staging, CI) → no media.prefix
    //   S3_BUCKET unset (enabled: false — local dev)         → media.prefix ADDED
    //
    // So it introduces a brand-new environment-dependent field, which is the
    // exact class of bug the unconditional registration above exists to remove.
    // Worse, adding that column to the databases to match would make CI — which
    // runs with a bucket — generate `ALTER TABLE "media" DROP COLUMN "prefix"`
    // forever. The option's promise holds for a plugin that is always on or
    // always off; it does not hold when `enabled` is itself computed from env.
    //
    // The migration-snapshot half is covered instead by the S3_BUCKET default in
    // package.json's `migrate:create` and the Migration snapshots CI workflow.
    s3Storage({
      enabled: Boolean(process.env.S3_BUCKET),
      collections: {
              media: true,
              // Invoice numbering restarts at INV-00001 for every store, so the
              // per-tenant prefix (composed as invoices/<tenantId>/<filename>) is
              // what makes a key collision between two stores structurally
              // impossible. Filenames additionally de-duplicate globally —
              // `invoices_filename_idx` is unique across the whole collection and
              // `generateFileData` runs before the beforeChange hook that sets
              // `prefix`, so a second store's INV-00001 is stored as
              // invoice-INV-00001-1.pdf. `media` is deliberately left unprefixed —
              // re-keying its 52 live objects belongs with the MEDIA-PIPELINE
              // backfill, not here.
              invoices: { prefix: 'invoices' },
            },
      useCompositePrefixes: true,
      // Empty only when `enabled` is false, where it is never read.
      bucket: process.env.S3_BUCKET ?? '',
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        // Path-style addressing. The bucket is Cloudflare R2 as of
        // 26 Jul 2026 (`S3_ENDPOINT` → *.r2.cloudflarestorage.com), which
        // accepts it; an earlier comment here claimed Supabase, which is
        // no longer where this points. Read `S3_ENDPOINT` before trusting
        // any provider named in a comment — the endpoint is the only
        // source of truth, and free tiers differ tenfold (R2 10 GB).
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
      },
    }),
    // Tenant-facing MCP server — lets a store owner connect their AI tool (Claude Desktop, Cursor)
    // to their store at `<store-host>/api/mcp` with a `payload-mcp-api-keys` Bearer key. Tenant is
    // resolved from the request Host and enforced by the same host-bound access as the admin (the
    // plugin's built-in ops run with overrideAccess:false), so a key only ever sees its own store.
    // v1 = "safe writes only": no deletes anywhere, orders read-only, page writes forced to draft
    // (see the MCP beforeChange hook in Pages.ts). See docs/plan for the full design.
    mcpPlugin({
      collections: {
        products: {
          description: 'Store products (catalog). Find/create/update; price, stock, description, status.',
          enabled: { find: true, create: true, update: true, delete: false },
        },
        categories: {
          description: 'Product categories for organising the catalog.',
          enabled: { find: true, create: true, update: true, delete: false },
        },
        orders: {
          description: 'Customer orders. Read-only — inspect status, line items, totals, fulfillment.',
          enabled: { find: true, create: false, update: false, delete: false },
        },
        pages: {
          description:
            'Storefront pages composed of blocks (see the list_blocks tool). Creates/updates are ' +
            'saved as DRAFT for the owner to review and publish.',
          enabled: { find: true, create: true, update: true, delete: false },
        },
      },
      // Lock the plugin's api-keys collection to owner-scoped access (see apiKeysAccess.ts).
      overrideApiKeyCollection: hardenMcpApiKeys,
      // Core grants every tool. The hosted overlay (src/hosted/config.ts, via
      // config-overlay.ts) gates the write tools by plan; the OSS build's
      // overlay is the identity, so self-host gets everything.
      overrideAuth: async (req, getDefaultMcpAccessSettings) => {
        const settings = await getDefaultMcpAccessSettings()
        return (await gateMcpAccess(req, settings as Record<string, unknown>)) as typeof settings
      },
      mcp: {
        serverOptions: {
          serverInfo: { name: 'Niblr Store MCP', version: '1.0.0' },
          instructions:
            'Manage this Niblr store: read/create/update products and categories, read orders, and ' +
            'compose storefront pages from blocks. Call list_blocks before creating or updating a page. ' +
            'Page changes are saved as drafts for the owner to publish.',
        },
        tools: [listBlocksTool()],
      },
    }),
    // Runs after mcpPlugin (see MCP_PURGE_PLUGIN_ORDER) so it can wrap the
    // endpoint that plugin registers.
    mcpCachePurge,
  ],
}

export default buildConfig(compose(coreConfig))
