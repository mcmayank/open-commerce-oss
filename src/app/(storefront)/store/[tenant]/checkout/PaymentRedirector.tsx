'use client'

import React, { useEffect, useRef } from 'react'

/**
 * Renders and auto-submits a signed HTML form POST to a provider's hosted page.
 *
 * Some gateways (Amazon Payment Services, HyperPay, CCAvenue) don't return a
 * redirect URL — they require a server-signed form POST. `startCheckout` returns
 * this descriptor as `formRedirect`; the client mounts it and submits it. Still
 * a full redirect off our domain, still zero card data on our side.
 *
 * URL and `none` redirects are handled server-side via `redirect()`, so this
 * component only ever receives the `form` case.
 *
 * ⚠ CSP: the storefront policy sets `form-action 'self'` (src/lib/csp.ts), which
 * blocks this cross-origin submit. Nothing breaks today — none of the seven
 * adapters in src/payments/core/provider-registry.ts returns `kind: 'form'`, so
 * this component is never mounted. The first adapter that does MUST add that
 * gateway's form-POST origin to `form-action` in src/lib/csp.ts as part of the
 * same change. The failure mode if it isn't done is silent: the browser refuses
 * the submit, no redirect happens, and the customer sits on the "Redirecting
 * you to the payment provider…" text below with nothing in the UI to say why.
 */
export interface FormRedirect {
  kind: 'form'
  action: string
  method: 'POST'
  fields: Record<string, string>
}

export default function PaymentRedirector({ redirect }: { redirect: FormRedirect }) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    formRef.current?.submit()
  }, [])

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
      Redirecting you to the payment provider…
      <form ref={formRef} action={redirect.action} method={redirect.method} className="hidden">
        {Object.entries(redirect.fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} readOnly />
        ))}
      </form>
    </div>
  )
}
