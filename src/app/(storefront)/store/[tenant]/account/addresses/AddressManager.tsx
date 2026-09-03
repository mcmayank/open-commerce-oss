'use client'

import React, { useActionState, useState } from 'react'
import { addAddress, updateAddress, removeAddress, type AddressState } from './actions'

export interface Address {
  line1: string
  line2?: string | null
  city: string
  state?: string | null
  postalCode: string
  country: string
}

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500'

/** Shared address input fields, reused by the add and edit forms. */
function AddressFields({ value }: { value?: Address }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Address line 1 <span className="text-red-500">*</span>
        </label>
        <input name="line1" type="text" required defaultValue={value?.line1 ?? ''} className={inputClass} placeholder="123 Main St" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address line 2</label>
        <input name="line2" type="text" defaultValue={value?.line2 ?? ''} className={inputClass} placeholder="Apartment, suite, etc. (optional)" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            City <span className="text-red-500">*</span>
          </label>
          <input name="city" type="text" required defaultValue={value?.city ?? ''} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">State / Province</label>
          <input name="state" type="text" defaultValue={value?.state ?? ''} className={inputClass} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Postal code <span className="text-red-500">*</span>
          </label>
          <input name="postalCode" type="text" required defaultValue={value?.postalCode ?? ''} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Country <span className="text-red-500">*</span>
          </label>
          <input name="country" type="text" required defaultValue={value?.country ?? ''} className={inputClass} />
        </div>
      </div>
    </div>
  )
}

function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-button)' }}
    >
      {pending ? pendingLabel : label}
    </button>
  )
}

function AddressCard({ address, index }: { address: Address; index: number }) {
  const [editing, setEditing] = useState(false)
  const [editState, editAction, editPending] = useActionState<AddressState, FormData>(updateAddress, null)
  const [removeState, removeAction, removePending] = useActionState<AddressState, FormData>(removeAddress, null)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {editing ? (
        <form action={editAction} noValidate className="space-y-4">
          <input type="hidden" name="index" value={index} />
          {editState?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{editState.error}</div>
          )}
          <AddressFields value={address} />
          <div className="flex items-center gap-3">
            <SubmitButton pending={editPending} label="Save changes" pendingLabel="Saving…" />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm text-gray-700">
            <p className="font-medium text-gray-900">{address.line1}</p>
            {address.line2 && <p>{address.line2}</p>}
            <p>
              {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
            </p>
            <p>{address.country}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              Edit
            </button>
            <form action={removeAction}>
              <input type="hidden" name="index" value={index} />
              <button
                type="submit"
                disabled={removePending}
                className="text-sm font-medium text-red-600 transition-colors hover:text-red-700 disabled:opacity-60"
              >
                {removePending ? 'Removing…' : 'Remove'}
              </button>
            </form>
          </div>
        </div>
      )}
      {removeState?.error && (
        <p className="mt-2 text-sm text-red-700">{removeState.error}</p>
      )}
    </div>
  )
}

export default function AddressManager({ addresses }: { addresses: Address[] }) {
  const [addState, addAction, addPending] = useActionState<AddressState, FormData>(addAddress, null)
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-6">
      {addresses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500">
          No saved addresses yet.
        </div>
      ) : (
        <div className="space-y-4">
          {addresses.map((address, index) => (
            <AddressCard key={index} address={address} index={index} />
          ))}
        </div>
      )}

      {adding ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Add a new address</h2>
          <form
            action={addAction}
            noValidate
            className="space-y-4"
            key={addState?.success ? 'reset' : 'form'}
          >
            {addState?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{addState.error}</div>
            )}
            <AddressFields />
            <div className="flex items-center gap-3">
              <SubmitButton pending={addPending} label="Save address" pendingLabel="Saving…" />
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          + Add a new address
        </button>
      )}
    </div>
  )
}
