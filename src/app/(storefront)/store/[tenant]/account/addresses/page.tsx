import { notFound, redirect } from 'next/navigation'
import React from 'react'
import { getStore, getStoreSettings } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/auth/session'
import AccountChrome from '../../components/AccountChrome'
import AddressManager, { type Address } from './AddressManager'

export default async function AddressesPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const customer = await getCurrentCustomer()
  if (!customer) redirect('/account/login')

  const { tenant } = await params
  const store = await getStore(tenant)
  if (!store) notFound()

  const settings = await getStoreSettings(store.id)

  // Pass only address data to the client — never passwordHash or other customer fields.
  const addresses: Address[] = (customer.addresses ?? []).map((a) => ({
    line1: a.line1,
    line2: a.line2 ?? null,
    city: a.city,
    state: a.state ?? null,
    postalCode: a.postalCode,
    country: a.country,
  }))

  return (
    <AccountChrome store={store} settings={settings}>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <a
            href="/account"
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--color-primary)' }}
          >
            &larr; Account
          </a>
          <span className="text-gray-300">/</span>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Saved Addresses</h1>
        </div>

        <AddressManager addresses={addresses} />
      </main>
    </AccountChrome>
  )
}
