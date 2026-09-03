import type { Block } from 'payload'

/**
 * The one block that renders any merchant-defined section. Payload builds its
 * blocks schema at boot and cannot learn per-tenant block types, so a merchant's
 * sections cannot literally join PAGE_BLOCKS — instead this single block's
 * `definition` relationship points at whichever of their saved sections they want.
 * One block type, unlimited section shapes, one migration ever.
 */
export const CustomSection: Block = {
  slug: 'customSection',
  labels: { singular: 'Custom section', plural: 'Custom sections' },
  fields: [
    {
      name: 'definition',
      type: 'relationship',
      relationTo: 'section-definitions',
      required: true,
      admin: { description: 'Which of your saved sections to show here.' },
    },
    {
      name: 'scheme',
      type: 'select',
      // The empty option is required. Both existing theme enums shipped without
      // theirs while the UI still offered "Theme default", and saving the value
      // the merchant picked failed.
      options: [
        { label: 'Theme default', value: '' },
        { label: 'Default', value: 'default' },
        { label: 'Muted', value: 'muted' },
        { label: 'Inverse', value: 'inverse' },
        { label: 'Accent', value: 'accent' },
      ],
      admin: {
        description:
          'Colour band for this placement. Left blank, it is filled in from the section’s own default when you save.',
      },
    },
    {
      name: 'content',
      type: 'json',
      admin: {
        description: 'The words and pictures for this placement.',
        components: { Field: '@/components/admin/RecipeContentField' },
      },
    },
  ],
}
