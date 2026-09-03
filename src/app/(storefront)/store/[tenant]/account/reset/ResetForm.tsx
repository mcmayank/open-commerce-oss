'use client'

import React, { useActionState } from 'react'
import type { resetPassword, ResetState } from './actions'

interface ResetFormProps {
  action: typeof resetPassword
  token: string
}

export default function ResetForm({ action, token }: ResetFormProps) {
  const [state, formAction, isPending] = useActionState<ResetState, FormData>(action, null)

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Pass token via hidden field — it's HMAC-signed, not secret PII */}
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          New password <span className="text-red-500">*</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          placeholder="At least 8 characters"
        />
        <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters.</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: 'var(--color-primary)',
          borderRadius: 'var(--radius-button)',
        }}
      >
        {isPending ? 'Resetting…' : 'Reset password'}
      </button>

      <p className="text-center text-sm text-gray-600">
        <a
          href="/account/login"
          className="font-medium"
          style={{ color: 'var(--color-primary)' }}
        >
          Back to sign in
        </a>
      </p>
    </form>
  )
}
