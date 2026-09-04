import type { Block } from 'payload'

/**
 * Reviews — editor-authored customer reviews with a star rating and an optional
 * link to the reviewed product. Distinct from Testimonials (which are generic,
 * unrated quotes). This is NOT a user-generated review system — a real reviews
 * collection with submission/moderation is separate future work.
 */
export const Reviews: Block = {
  slug: 'reviews',
  interfaceName: 'ReviewsBlock',
  labels: { singular: 'Reviews', plural: 'Reviews' },
  fields: [
    {
      name: 'variant', type: 'select', required: true, defaultValue: 'cards',
      options: [
        { label: 'Cards', value: 'cards' },
        { label: 'List', value: 'list' },
        { label: 'Masonry', value: 'masonry' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    { name: 'heading', type: 'text' },
    {
      name: 'items', type: 'array', minRows: 1,
      labels: { singular: 'Review', plural: 'Reviews' },
      fields: [
        { name: 'rating', type: 'number', required: true, defaultValue: 5, min: 1, max: 5, admin: { description: 'Stars, 1–5.' } },
        { name: 'quote', type: 'textarea', required: true },
        { name: 'author', type: 'text', required: true },
        { name: 'role', type: 'text', admin: { description: 'e.g. “Verified buyer”.' } },
        {
          name: 'product', type: 'relationship', relationTo: 'products',
          admin: { description: 'Optional — link this review to a product.' },
        },
      ],
    },
  ],
}
