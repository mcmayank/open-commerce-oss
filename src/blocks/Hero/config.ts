import type { Block } from 'payload'

/**
 * Hero block (unified). Supersedes splitHero and mediaHero: one block, one
 * `variant` picker. Legacy fields (backgroundImage/ctaLabel/ctaHref) are kept so
 * existing `hero` rows render unchanged on the default `centered` variant; new
 * layouts use `media` + primary/secondary CTAs. Fully theme-token driven — see
 * src/blocks/lib/colorScheme.ts and docs/THEMING-HOOKS.md.
 */
export const Hero: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  fields: [
    {
      name: 'variant', type: 'select', required: true, defaultValue: 'centered',
      options: [
        { label: 'Centered', value: 'centered' },
        { label: 'Split (media beside text)', value: 'split' },
        { label: 'Full-bleed overlay', value: 'overlay' },
        { label: 'Video background (Pro)', value: 'video' },
        { label: 'Stacked', value: 'stacked' },
        { label: 'Showcase (Pro)', value: 'showcase' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    {
      // No DB column (type: 'ui') — the panel reads/writes the page-level
      // `blockStyles[this block's id]` jsonb directly via form hooks. See
      // src/components/admin/BlockStyleField.tsx for the mechanism.
      name: 'blockStyle', type: 'ui',
      admin: { components: { Field: '@/components/admin/BlockStyleField' } },
    },
    {
      // Per-instance colour band; read by RenderBlocks (src/blocks/index.tsx) which
      // resolves block.scheme over BLOCK_DEFAULT_SCHEME. Empty option required —
      // an unset select is '' and must round-trip.
      name: 'scheme', type: 'select',
      options: [
        { label: 'Theme default', value: '' },
        { label: 'Default', value: 'default' },
        { label: 'Muted', value: 'muted' },
        { label: 'Inverse', value: 'inverse' },
        { label: 'Accent', value: 'accent' },
      ],
      admin: { description: 'Colour band for this hero. Blank = the store theme’s default.' },
    },

    // ── content (shared) ──
    { name: 'eyebrow', type: 'text' },
    { name: 'heading', type: 'text', required: true },
    {
      name: 'headingAccent', type: 'text',
      admin: {
        description: 'Optional second line, shown in the accent colour (two-tone heading).',
        condition: (_d, s) => s?.variant === 'showcase',
      },
    },
    { name: 'subheading', type: 'textarea' },
    {
      name: 'featureChip', type: 'text',
      admin: {
        description: 'Small trust chip under the text, e.g. “Gluten & dairy free”.',
        condition: (_d, s) => s?.variant === 'showcase',
      },
    },

    // ── media ──
    {
      name: 'media', type: 'upload', relationTo: 'media',
      admin: {
        description: 'Image OR video (mp4/webm). Used by every variant except plain Centered, which can also use the legacy background image below.',
        condition: (_d, s) => s?.variant !== 'centered',
      },
    },
    {
      name: 'poster', type: 'upload', relationTo: 'media',
      admin: {
        description: 'Fallback frame shown while a background video loads.',
        condition: (_d, s) => s?.variant === 'video',
      },
    },

    // ── layout knobs (conditional) ──
    {
      name: 'mediaSide', type: 'radio', defaultValue: 'right',
      options: [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }],
      admin: { layout: 'horizontal', condition: (_d, s) => s?.variant === 'split' || s?.variant === 'showcase' },
    },
    {
      name: 'textAlign', type: 'radio', defaultValue: 'center',
      options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }],
      admin: { layout: 'horizontal', condition: (_d, s) => ['centered', 'overlay', 'stacked'].includes(s?.variant) },
    },
    {
      name: 'verticalAlign', type: 'radio', defaultValue: 'middle',
      options: [{ label: 'Top', value: 'top' }, { label: 'Middle', value: 'middle' }, { label: 'Bottom', value: 'bottom' }],
      admin: { layout: 'horizontal', description: 'Vertical position of the text over the media.', condition: (_d, s) => s?.variant === 'overlay' || s?.variant === 'video' },
    },
    {
      name: 'overlay', type: 'select', defaultValue: 'medium',
      options: [{ label: 'None', value: 'none' }, { label: 'Light', value: 'light' }, { label: 'Medium', value: 'medium' }, { label: 'Dark', value: 'dark' }],
      admin: { description: 'Darkening scrim over the media so text stays legible.', condition: (_d, s) => s?.variant === 'overlay' || s?.variant === 'video' },
    },
    {
      // Shown on EVERY variant. It was previously conditioned to overlay/video,
      // and only the overlay/video render branch consumed it — so four of the six
      // layouts had no height control at all. `auto` means "keep this variant's
      // own natural height" (see MIN_H_FALLBACK in Component.tsx), which is what
      // every pre-existing row was migrated to in 20260829_hero_min_height_auto:
      // rows stored 'lg' from the old defaultValue while the field was hidden,
      // and applying that literally would have grown every live centered hero
      // from 420px to 480px.
      name: 'minHeight', type: 'select', defaultValue: 'auto',
      options: [
        { label: 'Auto (fits content)', value: 'auto' },
        { label: 'Medium (380px)', value: 'md' },
        { label: 'Large (480px)', value: 'lg' },
        { label: 'Half screen', value: 'half' },
        { label: 'Three-quarter screen', value: 'threeQuarter' },
        { label: 'Full screen', value: 'screen' },
      ],
      admin: { description: 'Minimum height of the hero. “Auto” keeps this layout’s natural height.' },
    },

    // ── CTAs ──
    { name: 'primaryCtaLabel', type: 'text' },
    { name: 'primaryCtaHref', type: 'text', admin: { description: 'e.g. /products' } },
    { name: 'secondaryCtaLabel', type: 'text' },
    { name: 'secondaryCtaHref', type: 'text' },

    // ── showcase floating cards ──
    {
      name: 'floatingCards', type: 'array', maxRows: 2,
      admin: {
        description: 'Up to two info cards pinned over the media.',
        condition: (_d, s) => s?.variant === 'showcase',
      },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'subtitle', type: 'text' },
        {
          name: 'corner', type: 'select', defaultValue: 'topRight',
          options: [
            { label: 'Top left', value: 'topLeft' }, { label: 'Top right', value: 'topRight' },
            { label: 'Bottom left', value: 'bottomLeft' }, { label: 'Bottom right', value: 'bottomRight' },
          ],
        },
      ],
    },

    // ── legacy (kept for existing rows; centered variant reads these) ──
    { name: 'backgroundImage', type: 'upload', relationTo: 'media', admin: { condition: (_d, s) => s?.variant === 'centered' || !s?.variant } },
    { name: 'ctaLabel', type: 'text', admin: { condition: (_d, s) => s?.variant === 'centered' || !s?.variant } },
    { name: 'ctaHref', type: 'text', admin: { description: 'e.g. /products', condition: (_d, s) => s?.variant === 'centered' || !s?.variant } },
  ],
}
