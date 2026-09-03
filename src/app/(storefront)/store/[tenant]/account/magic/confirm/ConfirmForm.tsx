'use client'

import React, { useActionState } from 'react'
import type { consumeMagicLink, ConsumeState } from './actions'

interface ConfirmFormProps {
  action: typeof consumeMagicLink
  token: string
}

export default function ConfirmForm({ action, token }: ConfirmFormProps) {
  const [state, formAction, isPending] = useActionState<ConsumeState, FormData>(action, null)

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-button)' }}
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-gray-600">
        <a href="/account/login" className="font-medium" style={{ color: 'var(--color-primary)' }}>
          Back to sign in
        </a>
      </p>
    </form>
  )
}
