import type { CollectionConfig } from 'payload'
import { isSuperAdmin, isSuperAdminAccess, type TenantsArrayUser } from '@/access/roles'
import { renderPasswordReset } from '@/emails'
import { NAV_GROUPS } from './nav-groups'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    forgotPassword: {
      generateEmailSubject: () => 'Reset your Niblr password',
      generateEmailHTML: async (args) => {
        const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://niblr.store'
        const token = (args as { token?: string } | undefined)?.token ?? ''
        return renderPasswordReset({ resetUrl: `${base}/admin/reset/${token}`, storeName: 'Niblr' })
      },
    },
  },
  labels: { singular: 'Member', plural: 'Team' },
  admin: {
    group: NAV_GROUPS.users,
    useAsTitle: 'email',
  },
  access: {
    read: ({ req }) => {
      const user = req.user as (TenantsArrayUser & { id: number | string }) | null
      if (!user) return false
      if (isSuperAdmin(user)) return true
      return { id: { equals: user.id } }
    },
    create: isSuperAdminAccess,
    update: ({ req }) => {
      const user = req.user as (TenantsArrayUser & { id: number | string }) | null
      if (!user) return false
      if (isSuperAdmin(user)) return true
      return { id: { equals: user.id } }
    },
    delete: isSuperAdminAccess,
  },
  fields: [
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: ['super-admin'],
      access: { update: ({ req }) => isSuperAdmin(req.user as TenantsArrayUser | null) },
    },
    // `tenants` array field is injected by @payloadcms/plugin-multi-tenant
  ],
}
