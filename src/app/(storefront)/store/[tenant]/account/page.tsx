import { notFound, redirect } from 'next/navigation'
import React from 'react'
import { getStore, getStoreSettings } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/auth/session'
import AccountChrome from '../components/AccountChrome'

export default async function AccountDashboard({
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

  return (
    <AccountChrome store={store} settings={settings}>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="mb-1 text-3xl font-bold tracking-tight text-gray-900">
          My Account
        </h1>
        <p className="mb-8 text-sm text-gray-500">
          Welcome back, {customer.name ?? customer.email}!
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="/account/orders"
            className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: 'var(--color-primary)', opacity: 0.9 }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Order History</h2>
            <p className="text-sm text-gray-500">View past orders and track deliveries.</p>
          </a>

          <a
            href="/account/addresses"
            className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: 'var(--color-primary)', opacity: 0.9 }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Saved Addresses</h2>
            <p className="text-sm text-gray-500">Manage your shipping addresses.</p>
          </a>
        </div>

        <div className="mt-10 border-t border-gray-100 pt-8">
          <p className="mb-3 text-sm text-gray-600">
            Signed in as <span className="font-medium">{customer.email}</span>
          </p>
          <form method="post" action="/account/logout">
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    </AccountChrome>
  )
}
