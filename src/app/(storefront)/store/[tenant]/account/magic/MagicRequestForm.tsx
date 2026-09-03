'use client'

import React, { useActionState } from 'react'
import type { requestMagicLink, MagicRequestState } from './actions'

interface MagicRequestFormProps {
  action: typeof requestMagicLink
}

export default function MagicRequestForm({ action }: MagicRequestFormProps) {
  const [state, formAction, isPending] = useActionState<MagicRequestState, FormData>(action, null)

  if (state && 'ok' in state && state.ok) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        {state.message}
      </div>
    )
  }

  return (
    <form action={formAction} noValidate className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email address <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-button)' }}
      >
        {isPending ? 'Sending…' : 'Email me a sign-in link'}
      </button>

      <p className="text-center text-sm text-gray-600">
        <a href="/account/login" className="font-medium" style={{ color: 'var(--color-primary)' }}>
          Back to sign in
        </a>
      </p>
    </form>
  )
}
