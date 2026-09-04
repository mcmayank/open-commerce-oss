import { notFound } from 'next/navigation'
import React from 'react'
import { getStore, getStoreSettings } from '@/lib/storefront'
import AccountChrome from '../../components/AccountChrome'
import MagicRequestForm from './MagicRequestForm'
import { requestMagicLink } from './actions'

export default async function MagicRequestPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  const store = await getStore(tenant)
  if (!store) notFound()

  const settings = await getStoreSettings(store.id)

  return (
    <AccountChrome store={store} settings={settings}>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:px-6">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">Sign in with a link</h1>
        <p className="mb-8 text-sm text-gray-500">
          Enter your email and we&apos;ll send you a one-time sign-in link.
        </p>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <MagicRequestForm action={requestMagicLink} />
        </div>
      </main>
    </AccountChrome>
  )
}
