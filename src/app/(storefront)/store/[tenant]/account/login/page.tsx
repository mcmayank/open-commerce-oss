import { notFound, redirect } from 'next/navigation'
import React from 'react'
import { getStore, getStoreSettings } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/auth/session'
import AccountChrome from '../../components/AccountChrome'
import LoginForm from './LoginForm'
import { loginCustomer } from './actions'

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ reset?: string }>
}) {
  // Redirect already-logged-in customers to their account
  const customer = await getCurrentCustomer()
  if (customer) redirect('/account')

  const { tenant } = await params
  const { reset } = await searchParams
  const store = await getStore(tenant)
  if (!store) notFound()

  const settings = await getStoreSettings(store.id)

  return (
    <AccountChrome store={store} settings={settings}>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:px-6">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">Sign in</h1>
        <p className="mb-8 text-sm text-gray-500">
          Welcome back! Sign in to view your orders and account details.
        </p>

        {reset === '1' && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Your password has been reset. Sign in with your new password.
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <LoginForm action={loginCustomer} />
        </div>
      </main>
    </AccountChrome>
  )
}
