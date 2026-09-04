import type { Block } from 'payload'

/**
 * MediaHero (legacy) — a full-bleed hero whose background is either an image OR a video.
 * Superseded by the unified Hero block (src/blocks/Hero/config.ts) per 2026-08-17 unified-hero plan.
 * Kept registered only so existing rows render; editors should use Hero for new content.
 * The single `media` upload accepts both; the component branches on the Media
 * mimeType (video → muted autoplay loop, image → <img>). Content (eyebrow, big
 * serif heading, subheading, two CTAs) is overlaid on a configurable scrim.
 * Non-premium; presentational; consumes per-tenant theme tokens.
 */
export const MediaHero: Block = {
  slug: 'mediaHero',
  interfaceName: 'MediaHeroBlock',
  labels: { singular: 'Media Hero (legacy — use Hero)', plural: 'Media Heroes (legacy)' },
  fields: [
    {
      name: 'variant', type: 'select', required: true, defaultValue: 'split',
      options: [
        { label: 'Split card (media + panel)', value: 'split' },
        { label: 'Full-bleed overlay', value: 'overlay' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Image OR video (mp4/webm). Video plays muted, looped, autoplay.' },
    },
    {
      name: 'poster',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional. Poster/fallback shown while a video loads.' },
    },
    { name: 'eyebrow', type: 'text' },
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'textarea' },
    {
      name: 'textAlign', type: 'radio', defaultValue: 'center',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
      admin: { layout: 'horizontal' },
    },
    {
      name: 'verticalAlign', type: 'radio', defaultValue: 'middle',
      options: [
        { label: 'Top', value: 'top' },
        { label: 'Middle', value: 'middle' },
        { label: 'Bottom', value: 'bottom' },
      ],
      admin: { layout: 'horizontal', description: 'Vertical position of the text over the media.' },
    },
    {
      name: 'overlay', type: 'select', defaultValue: 'medium',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Light', value: 'light' },
        { label: 'Medium', value: 'medium' },
        { label: 'Dark', value: 'dark' },
      ],
      admin: { description: 'Darkening scrim over the media so text stays legible.' },
    },
    {
      name: 'minHeight', type: 'select', defaultValue: 'lg',
      options: [
        { label: 'Medium', value: 'md' },
        { label: 'Large', value: 'lg' },
        { label: 'Full screen', value: 'screen' },
      ],
    },
    { name: 'primaryCtaLabel', type: 'text' },
    { name: 'primaryCtaHref', type: 'text', admin: { description: 'e.g. /products' } },
    { name: 'secondaryCtaLabel', type: 'text' },
    { name: 'secondaryCtaHref', type: 'text' },
  ],
}
