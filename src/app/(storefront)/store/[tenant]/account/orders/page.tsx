import { notFound, redirect } from 'next/navigation'
import React from 'react'
import { getStore, getStoreSettings, getCustomerOrders } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/auth/session'
import { formatMoney } from '@/lib/money'
import { formatFulfilmentSummary } from '@/lib/fulfillment'
import AccountChrome from '../../components/AccountChrome'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
  refunded: 'bg-red-100 text-red-700',
}

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const customer = await getCurrentCustomer()
  if (!customer) redirect('/account/login')

  const { tenant } = await params
  const store = await getStore(tenant)
  if (!store) notFound()

  const [settings, orders] = await Promise.all([
    getStoreSettings(store.id),
    getCustomerOrders(store.id, { id: customer.id, email: customer.email }),
  ])

  return (
    <AccountChrome store={store} settings={settings}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <a
            href="/account"
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--color-primary)' }}
          >
            &larr; Account
          </a>
          <span className="text-gray-300">/</span>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Order History</h1>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-24 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mb-4 h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-lg font-medium text-gray-500">No orders yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              When you place an order, it will appear here.
            </p>
            <a
              href="/products"
              className="mt-6 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-primary)' }}
            >
              Start shopping
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const date = new Date(order.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
              const itemCount = order.lineItems.reduce((sum, l) => sum + l.qty, 0)
              const statusColor = STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'
              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {order.orderNumber ?? `Order #${order.id}`}
                      </p>
                      <p className="text-sm text-gray-500">{date}</p>
                    </div>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  {(() => {
                    const summary = formatFulfilmentSummary(order.fulfillment ?? {})
                    if (!summary) return null
                    return <p className="mt-2 text-sm text-gray-600">{summary}</p>
                  })()}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                    <p className="text-sm text-gray-600">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </p>
                    <p className="text-base font-bold text-gray-900">
                      {formatMoney(order.total, order.currency)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </AccountChrome>
  )
}
