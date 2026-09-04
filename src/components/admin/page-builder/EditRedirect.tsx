'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DefaultEditView, useConfig, useDocumentInfo } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import type { DocumentViewClientProps } from 'payload'

/**
 * What `Pages.admin.components.views.edit.default` now points at.
 *
 * The builder lives at its own full-bleed root view (`PageBuilderRoute`), but
 * Payload's list view still links rows to the normal edit URL, so that URL has
 * to send people onward. It also has to keep the stock form reachable — spec
 * decision 1 — otherwise a field the builder cannot express becomes
 * uneditable. `DefaultEditView` is a public export of `@payloadcms/ui` and
 * renders correctly from inside `views.edit.default` (it reads everything it
 * needs off the Document view's own providers), so `?form=1` renders exactly
 * what Payload would have rendered here before this change.
 *
 * Exported separately as a pure predicate so the rule is tested without a
 * router or a DOM.
 */
export function shouldRenderStockForm(params: URLSearchParams): boolean {
  return params.get('form') === '1'
}

export default function EditRedirect(props: DocumentViewClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id } = useDocumentInfo()
  const {
    config: {
      routes: { admin: adminRoute },
    },
  } = useConfig()

  const stock = shouldRenderStockForm(new URLSearchParams(searchParams?.toString() ?? ''))

  React.useEffect(() => {
    if (stock || !id) return
    router.replace(
      formatAdminURL({ adminRoute, path: `/pages/${id}/builder`, relative: true }),
    )
  }, [adminRoute, id, router, stock])

  // A create (`id` undefined) has nothing to redirect to yet — Payload's own
  // form is the right place to give the page a title and a slug first, and the
  // builder route cannot exist until the document does.
  if (stock || !id) return <DefaultEditView {...props} />
  return null
}
