import type { Block } from 'payload'

export const NewsletterSignup: Block = {
  slug: 'newsletterSignup',
  interfaceName: 'NewsletterSignupBlock',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'placeholder',
      type: 'text',
      defaultValue: 'Enter your email address',
      admin: { description: 'Placeholder text for the email input' },
    },
  ],
}
