import { notFound, redirect } from 'next/navigation'
import React from 'react'
import { getStore, getStoreSettings } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/auth/session'
import AccountChrome from '../../components/AccountChrome'
import RegisterForm from './RegisterForm'
import { registerCustomer } from './actions'

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  // Redirect already-logged-in customers to their account
  const customer = await getCurrentCustomer()
  if (customer) redirect('/account')

  const { tenant } = await params
  const store = await getStore(tenant)
  if (!store) notFound()

  const settings = await getStoreSettings(store.id)

  return (
    <AccountChrome store={store} settings={settings}>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:px-6">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">Create account</h1>
        <p className="mb-8 text-sm text-gray-500">
          Shop faster, track orders, and save your details.
        </p>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <RegisterForm action={registerCustomer} />
        </div>
      </main>
    </AccountChrome>
  )
}
