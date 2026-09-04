import type { CollectionConfig } from 'payload'
import { encryptedSecretField } from '@/fields/encryptedSecret'
import { NAV_GROUPS } from './nav-groups'

export const MarketingConfigs: CollectionConfig = {
  slug: 'marketing-configs',
  labels: { singular: 'Email settings', plural: 'Email settings' },
  admin: {
    group: NAV_GROUPS['marketing-configs'],
    useAsTitle: 'fromEmail',
  },
  fields: [
    encryptedSecretField('resendApiKey'),
    {
      name: 'fromName',
      type: 'text',
    },
    {
      name: 'fromEmail',
      type: 'text',
      required: true,
      admin: {
        description: 'Must be a verified sender/domain in your Resend account',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
