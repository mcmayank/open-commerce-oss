/**
 * Intended nav section for every collection that appears in the merchant admin.
 *
 * Payload renders one nav section per distinct `admin.group`, so this table is
 * the design intent and `nav-groups.test.ts` asserts the collections match it.
 * Keeping it as data (rather than only as strings scattered across collection
 * files) is what lets the platform-hiding parity test below exist at all.
 */
export const NAV_GROUPS = {
  orders: 'Orders',
  invoices: 'Orders',
  products: 'Catalog',
  categories: 'Catalog',
  'discount-codes': 'Catalog',
  'import-jobs': 'Catalog',
  customers: 'Customers',
  campaigns: 'Marketing',
  contacts: 'Marketing',
  'marketing-configs': 'Marketing',
  pages: 'Storefront',
  media: 'Storefront',
  'store-settings': 'Storefront',
  'section-definitions': 'Storefront',
  domains: 'Settings',
  users: 'Settings',
} as const

/**
 * Sections holding PER-STORE content. On the platform apex a super-admin manages
 * the platform, not one store's content, so these are hidden there — by CSS id
 * in tenant-nav-links.css, because `admin.hidden` only receives `user`, not the
 * host. Settings is deliberately NOT here: Domains and Team are operator-relevant.
 */
export const PER_STORE_GROUPS = [
  'Orders',
  'Catalog',
  'Customers',
  'Marketing',
  'Storefront',
] as const
