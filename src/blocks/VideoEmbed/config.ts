import type { Block } from 'payload'

export const VideoEmbed: Block = {
  slug: 'videoEmbed',
  interfaceName: 'VideoEmbedBlock',
  labels: { singular: 'Video Embed', plural: 'Video Embeds' },
  fields: [
    {
      name: 'variant',
      type: 'select',
      required: true,
      defaultValue: 'contained',
      options: [
        { label: 'Contained', value: 'contained' },
        { label: 'Full bleed', value: 'fullBleed' },
        { label: 'Side by side', value: 'sideBySide' },
        { label: 'Text overlay', value: 'textOverlay' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    { name: 'heading', type: 'text' },
    {
      name: 'provider',
      type: 'select',
      required: true,
      defaultValue: 'youtube',
      options: [
        { label: 'YouTube', value: 'youtube' },
        { label: 'Vimeo', value: 'vimeo' },
      ],
      admin: {
        description:
          'Paste a YouTube or Vimeo URL. Niblr does not host video: there is no ' +
          'transcoding, no adaptive bitrate and no poster generation, so a 1080p ' +
          'upload stalls for shoppers on slow connections. YouTube and Vimeo do all ' +
          'three for free, and better.',
      },
    },
    {
      name: 'url',
      type: 'text',
      admin: { description: 'Paste the video page URL' },
    },
    { name: 'poster', type: 'upload', relationTo: 'media' },
    { name: 'caption', type: 'text' },
  ],
}
