import type { CollectionConfig } from 'payload'
import { hiddenFromTenantNav } from '@/access/roles'
import { encryptedSecretField } from '@/fields/encryptedSecret'
import { encryptedCredentialBlobField } from '@/fields/encryptedCredentialBlob'

/**
 * Payment configurations (physical slug kept as `gateway-configs` for back-compat —
 * renaming would churn the multi-tenant plugin map and the locked-documents FK).
 *
 * One row per `(tenant, provider)` (enforced by a unique index). Credentials are
 * stored in a single encrypted blob (`encryptedCredentials`) whose shape is the
 * provider adapter's `credentialSchema`. The legacy discrete columns
 * (`publishableKey` / `secretKey` / `webhookSecret` / `active`) are retained,
 * nullable, for one release so existing Stripe rows keep working; the
 * config-loader reads the blob first and falls back to the legacy columns.
 *
 * Editing happens through the custom Settings → Payments view, not this native
 * admin form.
 */
export const GatewayConfigs: CollectionConfig = {
  slug: 'gateway-configs',
  admin: {
    useAsTitle: 'provider',
    group: 'Payments',
    hidden: hiddenFromTenantNav,
    description: 'Payment provider configurations. Manage these from Settings → Payments.',
  },
  // Per-store uniqueness; hosted prefixes `tenant` (TENANT_INDEXES in src/hosted/config.ts).
  indexes: [{ fields: ['provider'], unique: true }],
  fields: [
    {
      name: 'provider',
      type: 'text',
      required: true,
      admin: {
        description:
          'Registry provider slug (e.g. stripe, razorpay, offline, mollie, paystack). ' +
          'Managed from Settings → Payments; adding a provider needs no schema change.',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Offer this provider at checkout when its configuration is valid.' },
    },
    {
      name: 'environment',
      type: 'select',
      defaultValue: 'test',
      options: [
        { label: 'Test', value: 'test' },
        { label: 'Live', value: 'live' },
      ],
      admin: { description: 'Which set of provider credentials this configuration represents.' },
    },
    // New: single encrypted credential blob (schema = adapter.credentialSchema).
    encryptedCredentialBlobField('encryptedCredentials'),
    {
      name: 'configurationVersion',
      type: 'number',
      defaultValue: 1,
      admin: { readOnly: true, description: 'Bumped on each credential rotation (for future key rotation).' },
    },
    // ── Legacy columns (kept nullable for back-compat; not written by new UI) ──
    {
      name: 'publishableKey',
      type: 'text',
      admin: {
        description: 'Legacy public/publishable key. Superseded by the encrypted credential blob.',
      },
    },
    encryptedSecretField('secretKey'),
    encryptedSecretField('webhookSecret'),
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Legacy single-active flag. Superseded by `enabled`.',
      },
    },
    {
      name: 'webhookUrl',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'Informational only. Register in your provider dashboard: ' +
          'https://<your-store-domain>/api/webhooks/<provider>/<tenant-slug>',
      },
    },
  ],
}
