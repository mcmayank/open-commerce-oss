import type { AdminViewServerProps } from 'payload'
import React from 'react'
import Link from 'next/link'
import { DocumentInfoProvider, EditDepthProvider, LivePreviewProvider } from '@payloadcms/ui'
import { handlePreview } from '@payloadcms/ui/rsc'
import { hasSavePermission as resolveHasSavePermission } from '@payloadcms/ui/shared'
import { docAccessOperation } from 'payload'
import type { Page } from '@/payload-types'
import PageBuilderView from './PageBuilderView'

/**
 * The page builder's own admin route, registered as a **root** custom view at
 * `/pages/:id/builder` (see `admin.components.views.pageBuilder` in
 * `src/payload.config.ts`).
 *
 * WHY A ROOT VIEW. Registered as `Pages.admin.components.views.edit.default`,
 * the builder rendered inside Payload's Document chrome, inside
 * `.template-default`, beside our own 248px admin nav — roughly 600px of
 * viewport left for a storefront preview on a laptop. Payload's router only
 * assigns a `templateType` inside its built-in-route switch; custom root views
 * are matched *after* it, so `templateType` stays undefined and `RootPage`
 * renders this component bare, with neither `MinimalTemplate` nor
 * `DefaultTemplate` (`@payloadcms/next/dist/views/Root/getRouteData.js`).
 * Full-bleed is therefore the *default* here — it is achieved by NOT opting
 * into `DefaultTemplate` the way `ImportReviewView` does, not by hiding chrome
 * with CSS.
 *
 * WHAT THAT COSTS. The Document view assembles a provider stack the builder
 * used to inherit. A root view has to hand-assemble it, and one piece fails
 * silently rather than loudly: without `docPermissions` /
 * `hasPublishPermission`, `PublishButton` returns `null` with no error
 * (`@payloadcms/ui/dist/elements/PublishButton/index.js` — `if
 * (!hasPublishPermission) return null`). So this view derives permissions
 * server-side via `docAccessOperation`, exactly as
 * `@payloadcms/next/dist/views/Document/getDocumentPermissions.js` does, and
 * passes them down. Likewise the preview URL: with no `LivePreviewProvider`
 * above it, `useLivePreviewContext()` returns a default context whose
 * `previewURL` is `undefined` and the canvas would show its
 * "save this page" placeholder forever. `handlePreview` runs
 * `Pages.admin.preview` server-side, so `PREVIEW_SECRET` still never reaches
 * client code.
 *
 * The one thing this view canNOT supply from the server is the initial form
 * state: `buildFormState` is not part of `@payloadcms/ui/rsc`'s export
 * surface. `PageBuilderView` therefore hydrates it once on mount through the
 * `getFormState` server function, which is mounted at the admin *root* layout
 * (`RootProvider` → `ServerFunctionsProvider`) and is available here.
 */
export async function PageBuilderRoute({ initPageResult, params }: AdminViewServerProps) {
  const { req } = initPageResult
  const { payload, user } = req

  const segmentsParam = (await params)?.segments
  const segments = Array.isArray(segmentsParam) ? segmentsParam : []
  // ['pages', '<id>', 'builder']
  const id = segments[0] === 'pages' && segments[2] === 'builder' ? segments[1] : undefined

  if (!id || !user) return <BuilderError>That page builder link is not valid.</BuilderError>

  // Mirrors `@payloadcms/next/dist/views/Document/getDocumentData.js`:
  // `draft: true` so the builder edits the working copy rather than the last
  // published one, and `overrideAccess: false` so this route is bound by the
  // same tenant-scoped access control as the rest of the admin — a page id is
  // guessable and this view is reachable from any store's admin host.
  const { transactionID: _transactionID, ...reqWithoutTransaction } = req
  const doc = (await payload
    .findByID({
      id,
      collection: 'pages',
      depth: 0,
      draft: true,
      overrideAccess: false,
      req: { ...reqWithoutTransaction },
      user,
    })
    .catch(() => null)) as Page | null

  if (!doc) return <BuilderError>That page was not found, or you can&apos;t edit it.</BuilderError>

  const collection = payload.collections.pages
  // `docAccessOperation` twice, against draft and published data — the same
  // two calls Payload's own `getDocumentPermissions` makes. The published one
  // is what decides whether the Publish button exists at all.
  const docPermissions = await docAccessOperation({
    id,
    collection,
    data: { ...doc, _status: 'draft' },
    req,
  })
  const hasPublishPermission = (
    await docAccessOperation({
      id,
      collection,
      data: { ...doc, _status: 'published' },
      req,
    })
  ).update
  const hasSavePermission = resolveHasSavePermission({
    collectionSlug: 'pages',
    docPermissions,
    isEditing: true,
  })

  // `PublishButton` greys itself out via
  // `hasPublishPermission && (modified || unpublishedVersionCount > 0 || !hasPublishedDoc)`,
  // so both of these are load-bearing: stub them and Publish is always live,
  // even on an untouched, already-published page. `versionCount` and
  // `mostRecentVersionIsAutosaved` feed only the version UI, which the builder
  // does not render, so they stay at their zero values.
  const publishedDoc =
    doc._status === 'published'
      ? doc
      : (
          await payload.find({
            collection: 'pages',
            depth: 0,
            limit: 1,
            // `req` matters here, not just for the transaction: this
            // collection's read access is host-bound
            // (`hostBoundConstraint` reads `req.headers.get('host')`), so a
            // synthetic request would resolve to no tenant and silently
            // report "no published version".
            req: { ...reqWithoutTransaction },
            overrideAccess: false,
            pagination: false,
            select: { updatedAt: true },
            user,
            where: { and: [{ _status: { equals: 'published' } }, { id: { equals: id } }] },
          })
        )?.docs?.[0]
  let unpublishedVersionCount = 0
  if (publishedDoc?.updatedAt) {
    // Access is already settled: this counts versions of one page that the
    // access-checked `findByID` above just returned, so there is nothing here
    // the caller could not already read. Left at the local API's default
    // `overrideAccess` deliberately — a collection-level `{ tenant: ... }`
    // constraint does not name a column on the versions table.
    ;({ totalDocs: unpublishedVersionCount } = await payload.countVersions({
      collection: 'pages',
      req: { ...reqWithoutTransaction },
      where: {
        and: [
          { parent: { equals: id } },
          { 'version._status': { equals: 'draft' } },
          { updatedAt: { greater_than: publishedDoc.updatedAt } },
        ],
      },
    }))
  }

  const { isPreviewEnabled, previewURL } = await handlePreview({
    collectionSlug: 'pages',
    config: payload.config,
    data: doc as unknown as Record<string, unknown>,
    operation: 'update',
    req,
  })

  return (
    <DocumentInfoProvider
      collectionSlug="pages"
      // Nothing in the builder renders the document-lock modal, so lock state
      // is inert here; `currentEditor` is required by the prop type and the
      // current user is the honest answer to "who is editing this".
      currentEditor={user}
      docPermissions={docPermissions}
      hasPublishedDoc={Boolean(publishedDoc)}
      hasPublishPermission={hasPublishPermission}
      hasSavePermission={hasSavePermission}
      id={id}
      initialData={doc}
      isEditing
      isLocked={false}
      lastUpdateTime={0}
      mostRecentVersionIsAutosaved={false}
      unpublishedVersionCount={unpublishedVersionCount}
      versionCount={0}
    >
      <LivePreviewProvider
        isLivePreviewEnabled={false}
        isLivePreviewing={false}
        isPreviewEnabled={Boolean(isPreviewEnabled)}
        previewURL={previewURL}
        url={undefined}
      >
        {/* Not decoration: `useEditDepth()` defaults to 0 outside a provider,
            and `useHotkey` only fires when the depth matches the number of
            open modals plus one — so without this, Cmd/Ctrl+S on Save draft
            and Publish silently stops working. The Document view mounts the
            same provider for the same reason. */}
        <EditDepthProvider>
          <PageBuilderView />
        </EditDepthProvider>
      </LivePreviewProvider>
    </DocumentInfoProvider>
  )
}

/**
 * The builder renders with no admin template around it, so its failure states
 * have to carry their own padding and their own way back — inline, the same
 * way `ImportReviewView` styles its own wrapper.
 */
function BuilderError({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '2rem', maxWidth: '40rem' }}>
      <h1>Page builder</h1>
      <p>{children}</p>
      <Link href="/admin/collections/pages">Back to Pages</Link>
    </div>
  )
}
