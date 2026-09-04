import type { Access, CollectionConfig, Config } from 'payload'
import { isStoreCollection } from '@/lib/store-collections'
import { getThemeMeta } from '@/themes/catalog'

/** Signed-in admin users only. The storefront reads with overrideAccess. */
const authenticated: Access = ({ req }) => Boolean(req.user)

/**
 * OSS build: exactly one store. Every store collection gets plain
 * authenticated access beneath whatever the collection declares itself
 * (explicit entries win, the same precedence `the hosted tenant-scoping wrapper` has in
 * the hosted overlay). No tenant field, no host binding.
 */
function withStoreAccess(c: CollectionConfig): CollectionConfig {
  if (!isStoreCollection(c.slug)) return c
  return {
    ...c,
    access: {
      read: authenticated,
      create: authenticated,
      update: authenticated,
      delete: authenticated,
      ...c.access,
    },
  }
}

/**
 * Hosted keeps the storefront theme on the tenant row; the single store keeps
 * it on store-settings. Read by the OSS store loader, written by the theme
 * try-on commit (both in oss/overrides/src/store-loader-overlay.ts).
 */
function withStoreTheme(c: CollectionConfig): CollectionConfig {
  if (c.slug !== 'store-settings') return c
  return {
    ...c,
    fields: [
      ...c.fields,
      {
        name: 'storefrontTheme',
        type: 'text',
        defaultValue: 'default',
        admin: { description: 'Storefront theme id. Pick one from the theme gallery on the storefront.' },
        validate: (value: unknown) =>
          !value || getThemeMeta(String(value)) ? true : `Unknown theme "${String(value)}".`,
      },
    ],
  }
}

export const compose = (core: Config): Config => ({
  ...core,
  collections: (core.collections ?? []).map(withStoreAccess).map(withStoreTheme),
})

/** OSS build: every MCP tool is available. */
export const gateMcpAccess = async (
  _req: unknown,
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> => settings
