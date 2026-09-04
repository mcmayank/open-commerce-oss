import type { SectionRecipe } from './types'

/**
 * The starting points a merchant picks from. Every preset must do something the
 * blocks in `PAGE_BLOCKS` (`src/blocks/registry.ts`) cannot — a preset that
 * duplicates a block offers a worse version of something the merchant already
 * has. Deliberately not a literal count here: it goes stale the moment a block
 * ships, same reasoning as `site-counts.ts`.
 *
 * Slot names are lowerCamelCase and unique within a recipe, per parse.ts.
 */
export type SectionPreset = {
  id: string
  name: string
  description: string
  recipe: SectionRecipe
}

export const SECTION_PRESETS: readonly SectionPreset[] = [
  {
    id: 'portraitCards',
    name: 'Portrait cards',
    description:
      'Tall image cards, each with a small label above its title and a short description below.',
    recipe: {
      version: 1,
      container: { width: 'wide', padding: 'roomy', scheme: 'default', align: 'center' },
      header: { heading: { name: 'title', label: 'Section title' } },
      items: {
        source: { kind: 'static', count: 3 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 3, desktop: 3 }, gap: 'normal' },
        template: [
          { kind: 'media', aspect: '4:5', fit: 'cover', slot: { name: 'image', label: 'Image' } },
          { kind: 'eyebrow', slot: { name: 'label', label: 'Small label' } },
          { kind: 'heading', level: 3, size: 'md', slot: { name: 'cardTitle', label: 'Title' } },
          { kind: 'text', size: 'sm', slot: { name: 'body', label: 'Description' } },
        ],
      },
    },
  },
  {
    id: 'peopleGrid',
    name: 'People grid',
    description: 'Square photos with a name, a role, a short bio and a link.',
    recipe: {
      version: 1,
      container: { width: 'wide', padding: 'roomy', scheme: 'default', align: 'center' },
      header: { heading: { name: 'title', label: 'Section title' } },
      items: {
        source: { kind: 'static', count: 4 },
        layout: { pattern: 'grid', columns: { mobile: 2, tablet: 4, desktop: 4 }, gap: 'normal' },
        template: [
          { kind: 'media', aspect: '1:1', fit: 'cover', slot: { name: 'photo', label: 'Photo' } },
          { kind: 'heading', level: 3, size: 'sm', slot: { name: 'name', label: 'Name' } },
          { kind: 'eyebrow', slot: { name: 'role', label: 'Role' } },
          { kind: 'text', size: 'sm', slot: { name: 'bio', label: 'Short bio' } },
          {
            kind: 'link',
            slot: { name: 'linkLabel', label: 'Link text' },
            hrefSlot: { name: 'linkHref', label: 'Link URL' },
          },
        ],
      },
    },
  },
  {
    id: 'captionedImages',
    name: 'Captioned images',
    description: 'An image grid where every tile carries a caption and a link.',
    recipe: {
      version: 1,
      container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'start' },
      header: { heading: { name: 'title', label: 'Section title' } },
      items: {
        source: { kind: 'static', count: 6 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'normal' },
        template: [
          { kind: 'media', aspect: '3:2', fit: 'cover', slot: { name: 'image', label: 'Image' } },
          { kind: 'heading', level: 3, size: 'sm', slot: { name: 'caption', label: 'Caption' } },
          {
            kind: 'link',
            slot: { name: 'linkLabel', label: 'Link text' },
            hrefSlot: { name: 'linkHref', label: 'Link URL' },
          },
        ],
      },
    },
  },
  {
    id: 'ctaCards',
    name: 'Cards with a button',
    description:
      'Icon cards with a title, a description and their own button, under a section heading and intro.',
    recipe: {
      version: 1,
      container: { width: 'wide', padding: 'roomy', scheme: 'muted', align: 'center' },
      header: {
        heading: { name: 'title', label: 'Section title' },
        body: { name: 'intro', label: 'Intro' },
      },
      items: {
        source: { kind: 'static', count: 3 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 3, desktop: 3 }, gap: 'roomy' },
        template: [
          { kind: 'icon', slot: { name: 'icon', label: 'Icon' } },
          { kind: 'heading', level: 3, size: 'md', slot: { name: 'cardTitle', label: 'Title' } },
          { kind: 'text', size: 'sm', slot: { name: 'body', label: 'Description' } },
          {
            kind: 'button',
            style: 'primary',
            slot: { name: 'ctaLabel', label: 'Button text' },
            hrefSlot: { name: 'ctaHref', label: 'Button URL' },
          },
        ],
      },
    },
  },
  {
    id: 'pressQuotes',
    name: 'Press quotes',
    description: 'An outlet mark above a short quote, linking to the article.',
    recipe: {
      version: 1,
      container: { width: 'wide', padding: 'roomy', scheme: 'muted', align: 'center' },
      header: { heading: { name: 'title', label: 'Section title' } },
      items: {
        source: { kind: 'static', count: 3 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 3, desktop: 3 }, gap: 'roomy' },
        template: [
          { kind: 'media', aspect: '3:2', fit: 'contain', slot: { name: 'outletMark', label: 'Outlet logo' } },
          { kind: 'text', size: 'md', slot: { name: 'quote', label: 'Quote' } },
          {
            kind: 'link',
            slot: { name: 'linkLabel', label: 'Link text' },
            hrefSlot: { name: 'linkHref', label: 'Article URL' },
          },
        ],
      },
    },
  },
]
