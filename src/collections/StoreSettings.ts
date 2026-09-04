import type { CollectionConfig } from 'payload'
import { analyticsGroup } from '@/fields/analyticsFields'
import { sanitizeCustomCss } from '@/lib/custom-css'
import { resolveFamily } from '@/lib/fonts/validate'
import { isEnforced, assertCustomCss } from '@/lib/plan-enforcement'
import { revalidateTenantHook } from '@/lib/storefront-cache'
import { sanitizeThemeCustomizations } from '@/lib/theme-customizations'
import { NAV_GROUPS } from './nav-groups'
import { storeIdOf } from '@/store-scope'

/** Font-weight choices for the heading/body weight selects (loaded in the storefront layout). */
const FONT_WEIGHT_OPTIONS = [
  { label: 'Light (300)', value: '300' },
  { label: 'Regular (400)', value: '400' },
  { label: 'Medium (500)', value: '500' },
  { label: 'Semibold (600)', value: '600' },
  { label: 'Bold (700)', value: '700' },
]

/** The three font slots and the axes field each one snapshots into. */
const FONT_SLOTS = [
  { family: 'fontFamily', axes: 'fontFamilyAxes' },
  { family: 'headingFont', axes: 'headingFontAxes' },
  { family: 'displayFont', axes: 'displayFontAxes' },
] as const

/**
 * Validates the merchant's chosen font families and snapshots each one's
 * catalog metadata onto its paired hidden axes field.
 *
 * Collection-level beforeValidate, matching sanitizeThemeCustomizations and
 * sanitizeCustomCss below — this collection's established choke point for
 * free-form input that must be validated and rewritten before it is persisted.
 *
 * Family and axes are written together, always. They must never drift apart:
 * the storefront builds its font URL from the axes alone, so a family stored
 * without its axes renders no <link> at all.
 *
 * The `in` check alone is not enough to tell "the merchant touched this slot"
 * apart from "Payload merged it back in": Payload's own field-level
 * beforeValidate pass runs before this collection-level hook and backfills
 * every field absent from the submitted data with its stored value
 * (getFallbackValue / cloneDataFromOriginalDoc), recursively into groups, on
 * both create and update. So `fontFamily in theme` is true on *every* save
 * that touches the theme group — an unrelated primaryColor edit backfills
 * fontFamily to its existing value before this hook ever sees the data.
 * Resolving it anyway would re-validate a family the merchant isn't touching
 * on every theme save, and fail the whole save if the catalog can no longer
 * see it (an expired API key falling back to the committed snapshot, or the
 * family being retired upstream) — breaking an unrelated colour change months
 * after the font was chosen. Comparing the submitted value against
 * `originalDoc` is what distinguishes a genuine change from a backfill: a
 * slot whose value is unchanged from the stored doc is skipped entirely
 * (family AND axes both left alone), and only a slot whose value actually
 * differs — including changing to `''` to explicitly revert to inherit — is
 * resolved and rewritten. On create there is no `originalDoc`, so every
 * present slot resolves.
 */
export async function resolveThemeFonts(
  data: Record<string, unknown> | undefined,
  originalDoc?: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  const theme = data?.theme as Record<string, unknown> | undefined
  if (!theme) return data

  const originalTheme = originalDoc?.theme as Record<string, unknown> | undefined

  for (const slot of FONT_SLOTS) {
    if (!(slot.family in theme)) continue
    if (originalDoc && theme[slot.family] === originalTheme?.[slot.family]) continue
    const { family, axes } = await resolveFamily(theme[slot.family])
    theme[slot.family] = family
    theme[slot.axes] = axes
  }
  return data
}

export const StoreSettings: CollectionConfig = {
  slug: 'store-settings',
  labels: { singular: 'Store & branding', plural: 'Store & branding' },
  admin: {
    group: NAV_GROUPS['store-settings'],
    useAsTitle: 'storeName',
  },
  hooks: {
    // themeCustomizations is free-form JSON — sanitize it against each theme's
    // declared field schema before it is validated/persisted (single choke point).
    beforeValidate: [
      ({ data }) => {
        if (data && 'themeCustomizations' in data) {
          data.themeCustomizations = sanitizeThemeCustomizations(data.themeCustomizations)
        }
        // Merchant CSS is free-form text; sanitize at the same choke point.
        // sanitizeCustomCss throws CustomCssError on malformed or oversized
        // input, which Payload surfaces to the merchant as a save error.
        if (data && 'customCss' in data) {
          data.customCss = sanitizeCustomCss(data.customCss)
        }
        return data
      },
      async ({ data, originalDoc }) =>
        resolveThemeFonts(
          data as Record<string, unknown> | undefined,
          originalDoc as Record<string, unknown> | undefined,
        ),
    ],
    beforeChange: [
      async ({ req, data, originalDoc }) => {
        if (!isEnforced(req)) return data
        const tenantId = storeIdOf(data as { tenant?: unknown }) ??
          storeIdOf(originalDoc as { tenant?: unknown } | undefined)
        if (tenantId === undefined) return data
        await assertCustomCss(
          req.payload,
          tenantId,
          (data as { customCss?: string }).customCss,
          (originalDoc as { customCss?: string } | undefined)?.customCss,
        )
        return data
      },
    ],
    afterChange: [revalidateTenantHook('settings').afterChange],
    afterDelete: [revalidateTenantHook('settings').afterDelete],
  },
  fields: [
    // Usage meter sits above the tabs so the plan/usage banner stays visible on every tab.
    {
      name: 'usageMeter',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/UsageMeter' } },
    },
    // Unnamed tabs (label, no name) are purely presentational — every field keeps its
    // existing top-level path (storeName, theme.*, fulfillment.*, analytics.*), so there
    // is no schema change, no data migration, and downstream readers are untouched.
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          description: 'Store identity buyers see across your storefront.',
          fields: [
            { name: 'storeName', type: 'text', required: true },
            {
              name: 'currency',
              type: 'select',
              required: true,
              defaultValue: 'AED',
              options: ['AED', 'INR', 'USD', 'EUR', 'GBP'],
            },
            { name: 'logo', type: 'upload', relationTo: 'media' },
            { name: 'description', type: 'textarea' },
          ],
        },
        {
          label: 'Branding',
          description: 'Colors, fonts, and theme customization for your storefront.',
          fields: [
            {
              name: 'theme',
              type: 'group',
              fields: [
                {
                  name: 'primaryColor',
                  type: 'text',
                  admin: {
                    description: 'Headings, links, and primary UI on your storefront.',
                    components: { Field: '@/components/admin/ColorField' },
                  },
                },
                {
                  name: 'accentColor',
                  type: 'text',
                  admin: {
                    description: 'Buttons and calls to action.',
                    components: { Field: '@/components/admin/ColorField' },
                  },
                },
                {
                  name: 'backgroundColor',
                  type: 'text',
                  admin: {
                    description: 'Page background.',
                    components: { Field: '@/components/admin/ColorField' },
                  },
                },
                {
                  name: 'textColor',
                  type: 'text',
                  admin: {
                    description: 'Body text.',
                    components: { Field: '@/components/admin/ColorField' },
                  },
                },
                {
                  name: 'fontFamily',
                  type: 'text',
                  label: 'Body font',
                  admin: {
                    description: 'Font for body text and UI. Choose a Google Font, or your visitors’ system font.',
                    components: { Field: '@/components/admin/FontField' },
                  },
                },
                {
                  // Written by the beforeValidate hook in Task 5, never by hand. Hidden because
                  // it is a snapshot of catalog metadata, not a merchant-facing setting.
                  name: 'fontFamilyAxes',
                  type: 'json',
                  admin: { hidden: true },
                },
                {
                  // Optional secondary font for headings. Unset → the template's heading font.
                  name: 'headingFont',
                  type: 'text',
                  label: 'Heading font',
                  admin: {
                    description:
                      'Optional secondary font for headings/display. Leave blank to use the template’s heading font.',
                    components: { Field: '@/components/admin/FontField' },
                  },
                },
                {
                  name: 'headingFontAxes',
                  type: 'json',
                  admin: { hidden: true },
                },
                {
                  // Optional third font role — the "span alternative font" the block-style
                  // vocabulary's `font: 'display'` control resolves to (--font-display).
                  // Unset → falls back to the heading font (resolveTokens in theme-tokens.ts).
                  name: 'displayFont',
                  type: 'text',
                  label: 'Display font',
                  admin: {
                    description:
                      'Optional third font for accent text and eyebrows in block styles. Leave blank to use your heading font.',
                    components: { Field: '@/components/admin/FontField' },
                  },
                },
                {
                  name: 'displayFontAxes',
                  type: 'json',
                  admin: { hidden: true },
                },
                {
                  // Optional. Unset → the template's heading weight (else the font's normal weight).
                  name: 'headingWeight',
                  type: 'select',
                  label: 'Heading weight',
                  admin: {
                    description:
                      'Font weight for headings. Leave blank to use the template default.',
                  },
                  options: FONT_WEIGHT_OPTIONS,
                },
                {
                  name: 'bodyWeight',
                  type: 'select',
                  label: 'Body weight',
                  admin: {
                    description:
                      'Font weight for body text. Leave blank to use the template default.',
                  },
                  options: FONT_WEIGHT_OPTIONS,
                },
                {
                  name: 'buttonRadius',
                  type: 'select',
                  admin: {
                    description:
                      'Corner rounding on buttons. Leave as Theme default to follow your template.',
                  },
                  options: [
                    { label: 'Theme default', value: '' },
                    { label: 'None', value: 'none' },
                    { label: 'Small', value: 'sm' },
                    { label: 'Medium', value: 'md' },
                    { label: 'Large', value: 'lg' },
                    { label: 'Full', value: 'full' },
                  ],
                  hooks: {
                    // '' is the UI's "inherit" sentinel. The column is a Postgres enum with no
                    // empty member, and absence is what resolveTokens reads as "use the theme",
                    // so normalise it to NULL rather than widening the enum — an enum value
                    // cannot be dropped once added.
                    beforeChange: [({ value }: { value?: unknown }) => (value === '' ? null : value)],
                  },
                },
              ],
            },
            {
              // Live storefront preview of the branding fields above — reflects unsaved
              // edits through the same resolveTokens + buildThemeCssVars path
              // (src/lib/theme-tokens.ts) the storefront uses at runtime, layered over
              // the tenant's active theme preset so "inherit" previews correctly.
              name: 'brandingPreview',
              type: 'ui',
              admin: { components: { Field: '@/components/admin/BrandingPreview' } },
            },
            {
              // Per-template customization values, keyed by theme slug, e.g.
              // { editorial: { heroHeadline: '…', accentColor: '#…' } }. Written by the
              // ThemeCustomizer UI field and sanitized in beforeValidate against each
              // theme's declared schema. Hidden: edited through the customizer, not raw.
              name: 'themeCustomizations',
              type: 'json',
              admin: { hidden: true },
            },
            {
              // Renders the dynamic form for the tenant's selected template's fields.
              name: 'themeCustomizer',
              type: 'ui',
              admin: { components: { Field: '@/components/admin/ThemeCustomizer' } },
            },
            {
              // Store-wide per-block-type style defaults, keyed by blockType, e.g.
              // { hero: { heading: { size: 'xl', weight: '700' } } }. One layer of the
              // three-layer resolveBlockStyle merge (theme default → this → per-instance
              // pages.blockStyles). Hidden: edited through the "Block style defaults" tab
              // below (BlockStyleDefaultsField), not as a raw JSON blob on this tab.
              name: 'blockStyleDefaults',
              type: 'json',
              admin: { hidden: true },
            },
            {
              name: 'customCss',
              type: 'textarea',
              label: 'Custom CSS',
              admin: {
                // Deliberately short, and it defers the rules to the published
                // doc rather than restating them. The previous version listed
                // every strip rule inline AND pointed at docs/THEMING-HOOKS.md —
                // a path inside a repo merchants cannot open. Two copies of the
                // same rules is how they drift; one copy, publicly reachable, is
                // the fix. Keep this in sync with content/docs/custom-css.mdx.
                description:
                  'CSS for your storefront content pages, written against the published data-nb-* attributes. Growth plan. Not applied to the cart or checkout pages — though the cart drawer, which appears on content pages, is styled. @import, external URLs and position: fixed are removed on save. Full reference and worked selectors: https://niblr.store/docs/custom-css',
                rows: 14,
                // Locked-but-visible for non-Premium tenants: assertCustomCss (below,
                // in beforeChange) fails the whole document save with a 403 the
                // instant a free-tier merchant types here and hits Save — with no
                // admin.condition/component the plain textarea gives no warning
                // beforehand. CustomCssField renders it disabled with a Premium
                // note instead, so the merchant learns before typing, not after
                // losing an unrelated edit made in the same sitting.
                components: { Field: '@/components/admin/CustomCssField' },
              },
            },
            {
              name: 'customCssEnabled',
              type: 'checkbox',
              label: 'Custom CSS enabled',
              defaultValue: true,
              admin: {
                description: 'Turn off to disable your custom CSS without deleting it.',
              },
            },
          ],
        },
        {
          label: 'Block style defaults',
          description:
            'Store-wide typography, media, and spacing defaults per block type. Applies to every block of that type unless overridden on the block itself.',
          fields: [
            {
              // The actual editor — writes into the hidden blockStyleDefaults json field
              // above via useField({ path: 'blockStyleDefaults' }), keyed by blockType.
              // Reuses the Task 6 vocabulary control renderer (StyleControlGroups.tsx).
              name: 'blockStyleDefaultsEditor',
              type: 'ui',
              label: 'Block style defaults',
              admin: { components: { Field: '@/components/admin/BlockStyleDefaultsField' } },
            },
          ],
        },
        {
          label: 'Navigation',
          description: 'The announcement bar and header links shown across your storefront.',
          fields: [
            {
              name: 'announcement',
              type: 'text',
              admin: {
                description:
                  'Optional bar shown above the header, e.g. “Order before 9pm · Collect the next morning”.',
              },
            },
            {
              name: 'navLinks',
              type: 'array',
              label: 'Navigation links',
              admin: {
                description:
                  'Header navigation. Leave empty to use the defaults (Home, Products, Account).',
              },
              fields: [
                { name: 'label', type: 'text', required: true },
                {
                  name: 'href',
                  type: 'text',
                  required: true,
                  admin: { description: 'e.g. /products or /products?category=sweet-pastries' },
                },
              ],
            },
            {
              name: 'headerLayout',
              type: 'select',
              defaultValue: 'theme',
              label: 'Top navigation layout',
              admin: {
                description:
                  'How the header is arranged. “Theme default” keeps the layout your template ships with.',
              },
              options: [
                { label: 'Theme default', value: 'theme' },
                { label: 'Standard — logo left, links right', value: 'standard' },
                { label: 'Centered — stacked and centered', value: 'centered' },
                { label: 'Editorial — logo left, links centered', value: 'editorial' },
              ],
            },
            {
              name: 'logoSize',
              type: 'select',
              defaultValue: 'medium',
              label: 'Logo size',
              admin: { description: 'Header logo size. Medium is the default.' },
              options: [
                { label: 'Small', value: 'small' },
                { label: 'Medium', value: 'medium' },
                { label: 'Large', value: 'large' },
                { label: 'Extra large', value: 'xlarge' },
              ],
            },
          ],
        },
        {
          label: 'Fulfillment',
          fields: [
            {
              name: 'fulfillment',
              type: 'group',
              admin: {
                description:
                  'Pickup / local-delivery scheduling. When enabled, checkout asks the buyer to choose a method, date and time window.',
              },
              fields: [
                { name: 'enabled', type: 'checkbox', defaultValue: false },
                {
                  name: 'timezone',
                  type: 'text',
                  defaultValue: 'Asia/Dubai',
                  admin: { description: 'IANA timezone the cutoff and windows are evaluated in.' },
                },
                {
                  name: 'cutoffTime',
                  type: 'text',
                  defaultValue: '21:00',
                  admin: {
                    description:
                      'HH:mm — orders placed before this collect/deliver next day; after it, the day after next.',
                  },
                },
                {
                  name: 'maxDaysAhead',
                  type: 'number',
                  defaultValue: 7,
                  min: 1,
                  admin: { description: 'How many days ahead a buyer can schedule.' },
                },
                {
                  name: 'pickup',
                  type: 'group',
                  fields: [
                    { name: 'enabled', type: 'checkbox', defaultValue: true },
                    {
                      name: 'locationLabel',
                      type: 'text',
                      admin: {
                        description: 'Shown to buyers, e.g. "SD Bakery, Jumeirah — Dubai".',
                      },
                    },
                    {
                      name: 'windows',
                      type: 'array',
                      fields: [
                        { name: 'label', type: 'text', required: true },
                        {
                          name: 'start',
                          type: 'text',
                          required: true,
                          admin: { description: 'HH:mm' },
                        },
                        {
                          name: 'end',
                          type: 'text',
                          required: true,
                          admin: { description: 'HH:mm' },
                        },
                      ],
                    },
                  ],
                },
                {
                  name: 'delivery',
                  type: 'group',
                  fields: [
                    { name: 'enabled', type: 'checkbox', defaultValue: false },
                    {
                      name: 'zones',
                      type: 'array',
                      fields: [
                        { name: 'name', type: 'text', required: true },
                        { name: 'areasNote', type: 'textarea' },
                        {
                          name: 'fee',
                          type: 'number',
                          required: true,
                          min: 0,
                          admin: {
                            description: 'Delivery fee in minor units (e.g. 1000 = AED 10.00).',
                          },
                        },
                      ],
                    },
                    {
                      name: 'windows',
                      type: 'array',
                      fields: [
                        { name: 'label', type: 'text', required: true },
                        {
                          name: 'start',
                          type: 'text',
                          required: true,
                          admin: { description: 'HH:mm' },
                        },
                        {
                          name: 'end',
                          type: 'text',
                          required: true,
                          admin: { description: 'HH:mm' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Tax',
          description:
            'Niblr calculates the tax on each order and shows it on the invoice. Filing and paying it remains yours — we never remit anything on your behalf.',
          fields: [
            {
              name: 'tax',
              type: 'group',
              fields: [
                {
                  name: 'enabled',
                  type: 'checkbox',
                  defaultValue: false,
                  label: 'I am registered for VAT',
                  admin: {
                    description:
                      'Off by default. While off, orders carry no tax and invoices show no VAT line at all — which is correct for an unregistered business.',
                  },
                },
                {
                  name: 'registrationNumber',
                  type: 'text',
                  label: 'Tax registration number (TRN)',
                  admin: {
                    description:
                      'Printed on every tax invoice. A UAE simplified tax invoice is not compliant without it, so "Tax Invoice" is only used as the heading once this is set.',
                    condition: (_, siblingData) => Boolean(siblingData?.enabled),
                  },
                  validate: (value: unknown, { siblingData }: { siblingData?: { enabled?: boolean } }) => {
                    if (!siblingData?.enabled) return true
                    return String(value ?? '').trim().length > 0
                      ? true
                      : 'A TRN is required once you mark yourself registered for VAT — it must appear on every tax invoice.'
                  },
                },
                {
                  name: 'rate',
                  type: 'number',
                  defaultValue: 5,
                  min: 0,
                  max: 100,
                  label: 'Rate (%)',
                  admin: {
                    description: 'e.g. 5 for the UAE, 15 for Saudi Arabia.',
                    condition: (_, siblingData) => Boolean(siblingData?.enabled),
                  },
                },
                {
                  name: 'pricesIncludeTax',
                  type: 'checkbox',
                  defaultValue: true,
                  label: 'My product prices already include VAT',
                  admin: {
                    description:
                      'The norm in the UAE and India, and the default here. When on, a listed AED 100 stays AED 100 at checkout and the VAT is shown as the portion contained within it. When off, VAT is added on top and the shopper pays more than the listed price.',
                    condition: (_, siblingData) => Boolean(siblingData?.enabled),
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Advanced',
          description: 'Invoicing and analytics integrations.',
          fields: [
            {
              name: 'nextInvoiceNumber',
              type: 'number',
              defaultValue: 1,
              admin: {
                readOnly: true,
                description: 'Next sequential invoice number for this store.',
              },
            },
            analyticsGroup,
          ],
        },
      ],
    },
  ],
}
