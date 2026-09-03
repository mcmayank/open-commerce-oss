'use client'

import React from 'react'
import type { Data, DocumentPreferences, FormState, SanitizedDocumentPermissions } from 'payload'
import type { useServerFunctions } from '@payloadcms/ui'

/**
 * The exact `getFormState` the admin's root `ServerFunctionsProvider` hands
 * out. Taken as a type rather than an import so this module stays free of any
 * runtime dependency on `@payloadcms/ui` — the client barrel transitively
 * imports a `.css` file, and keeping it out is what lets this hook be unit
 * tested at all.
 */
type GetFormState = ReturnType<typeof useServerFunctions>['getFormState']

export type BuilderFormStateArgs = {
  collectionSlug: string | undefined
  data: Data | undefined
  docPermissions: SanitizedDocumentPermissions | undefined
  getDocPreferences: () => Promise<DocumentPreferences>
  getFormState: GetFormState
  id: number | string | undefined
  operation: 'create' | 'update'
}

export type BuilderFormState = {
  /** The one-shot load resolved to nothing usable. Show an error, not a spinner. */
  failed: boolean
  state: FormState | undefined
}

/**
 * The builder's mount-time form state.
 *
 * Payload's Document view server-renders the whole initial form state and
 * hands it to the edit component as a `formState` prop. The builder is a root
 * view now (`PageBuilderRoute`), so it gets no such prop, and `buildFormState`
 * is not on `@payloadcms/ui/rsc`'s export surface — meaning the state cannot be
 * built in the RSC either. This hook makes the one call the route cannot.
 *
 * `renderAllFields: true` matches what the Document view passes for its own
 * initial build, and is what makes every block row arrive rendered rather than
 * only changed paths. It is NOT the same call as `PageBuilderView`'s onChange
 * handler, which deliberately keeps `renderAllFields: false`; do not conflate
 * them. `data` must be passed because `buildFormState` derives its data as
 * `incomingData || reduceFieldsToValues(formState)` and there is no prior form
 * state to reduce.
 */
export function useBuilderFormState({
  collectionSlug,
  data,
  docPermissions,
  getDocPreferences,
  getFormState,
  id,
  operation,
}: BuilderFormStateArgs): BuilderFormState {
  const [state, setState] = React.useState<FormState | undefined>(undefined)
  const [failed, setFailed] = React.useState(false)
  const startedRef = React.useRef(false)

  // NO cleanup / cancellation flag here, deliberately. `startedRef` already
  // makes this one-shot, and a cancel flag on top of it is not redundant but
  // actively broken: StrictMode runs every effect setup → cleanup → setup, so
  // the cleanup would cancel the only run the guard ever permits and the
  // builder would hang on its loading state for the whole of `pnpm dev`
  // (Next enables StrictMode by default for the App Router). Settling state
  // after unmount is a no-op in React 18+ and does not warn. Pinned by
  // useBuilderFormState.test.tsx.
  React.useEffect(() => {
    if (startedRef.current || !collectionSlug || !data) return
    startedRef.current = true
    void (async () => {
      try {
        const docPreferences = await getDocPreferences()
        const result = await getFormState({
          id,
          collectionSlug,
          data,
          docPermissions,
          docPreferences,
          operation,
          renderAllFields: true,
          schemaPath: collectionSlug,
          skipValidation: true,
        })
        if (result?.state) setState(result.state)
        else setFailed(true)
      } catch {
        setFailed(true)
      }
    })()
  }, [collectionSlug, data, docPermissions, getDocPreferences, getFormState, id, operation])

  return { failed, state }
}
