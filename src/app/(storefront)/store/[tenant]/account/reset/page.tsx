import { notFound } from 'next/navigation'
import React from 'react'
import { getStore, getStoreSettings } from '@/lib/storefront'
import AccountChrome from '../../components/AccountChrome'
import ResetForm from './ResetForm'
import { resetPassword } from './actions'

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { tenant } = await params
  const { token } = await searchParams

  const store = await getStore(tenant)
  if (!store) notFound()

  const settings = await getStoreSettings(store.id)

  return (
    <AccountChrome store={store} settings={settings}>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:px-6">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">Reset password</h1>
        <p className="mb-8 text-sm text-gray-500">Enter your new password below.</p>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <ResetForm action={resetPassword} token={token ?? ''} />
        </div>
      </main>
    </AccountChrome>
  )
}
