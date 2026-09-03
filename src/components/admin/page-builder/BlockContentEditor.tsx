'use client'

import * as React from 'react'
import {
  Drawer,
  RenderFields,
  useConfig,
  useDocumentInfo,
  useDrawerSlug,
  useFormFields,
  useModal,
} from '@payloadcms/ui'
import type { ClientBlock, ClientField } from 'payload'
import { contentFieldsFor, findBlockDefinitions, layoutFieldsFor } from '@/lib/page-builder/content-fields'
import { blockRowPath } from '@/lib/page-builder/edit-target'
import { useSelection } from './selection'

type Row = {
  id: string
  blockType?: string
}

/**
 * Content half of the page-builder inspector: the selected block's own fields,
 * rendered with Payload's `RenderFields` so every field type (upload, array,
 * richText, and any `admin.components.Field` override) behaves exactly as it
 * does in the stock blocks UI.
 *
 * WHY THIS EXISTS: the builder replaces Payload's edit form outright — it is
 * now its own full-bleed root view — so Payload's own blocks UI, the only
 * thing that rendered block content fields, never mounts. Before this component there was no way to type a hero heading,
 * and `heading` is `required`, so adding a Hero made the page unpublishable.
 *
 * PATH CONTRACT (mirrors `@payloadcms/ui`'s own BlockRow, which is the
 * reference implementation):
 *   parentPath       `layout.<rowIndex>`
 *   parentSchemaPath `<collection>.layout.<blockSlug>`
 *   parentIndexPath  ''
 * `RenderFields` derives each child's own path from these via
 * `getFieldPaths` (`payload/dist/fields/getFieldPaths.js`), joining on '.'.
 * `parentPath` in particular must be exact: `RenderField` looks a custom field
 * component up as `formState[path].customComponents.Field`, so an off-by-one
 * row index silently renders the WRONG block's custom components.
 *
 * BLOCK DEFINITIONS come from the client collection config rather than
 * `config.blocksMap` — see `findBlockDefinitions` for why that map is empty here.
 */
function useSelectedBlockFields(pick: 'content' | 'layout'): {
  fields: ClientField[]
  parentPath: string
  parentSchemaPath: string
  hasSelection: boolean
} {
  const { selectedId } = useSelection()
  const { collectionSlug } = useDocumentInfo()
  const { getEntityConfig } = useConfig()
  const rows = (useFormFields(([fields]) => fields.layout?.rows) ?? []) as Row[]

  const idx = rows.findIndex((row) => row.id === selectedId)
  const blockType = idx >= 0 ? rows[idx]?.blockType : undefined

  const blocks = React.useMemo(() => {
    if (!collectionSlug) return []
    const entity = getEntityConfig({ collectionSlug }) as { fields?: unknown[] } | undefined
    return findBlockDefinitions<ClientBlock>(entity?.fields, 'layout')
  }, [collectionSlug, getEntityConfig])

  const fields = React.useMemo(
    () =>
      pick === 'layout'
        ? layoutFieldsFor<ClientField>(blocks, blockType)
        : contentFieldsFor<ClientField>(blocks, blockType),
    [pick, blocks, blockType],
  )

  return {
    fields,
    // `blockRowPath` and not an inline template literal: the canvas text
    // editor writes through `fieldPath(idx, field)`, which is this same string
    // plus `.<fieldName>`. Sharing the one spelling is what makes "a canvas
    // edit and an inspector edit are literally the same write" true by
    // construction instead of by coincidence.
    parentPath: idx >= 0 ? blockRowPath(idx) : '',
    parentSchemaPath: `${collectionSlug ?? 'pages'}.layout.${blockType ?? ''}`,
    hasSelection: Boolean(selectedId),
  }
}

/**
 * The field tree itself, with no surrounding chrome. Rendered twice — once in
 * the inspector panel and once inside the expanded drawer — from this single
 * definition, so the narrow and wide layouts cannot drift apart.
 */
function BlockContentFields({
  fields,
  parentPath,
  parentSchemaPath,
}: {
  fields: ClientField[]
  parentPath: string
  parentSchemaPath: string
}) {
  const { docPermissions } = useDocumentInfo()
  return (
    <RenderFields
      className="nb-pb-content__fields"
      fields={fields}
      margins="small"
      parentIndexPath=""
      parentPath={parentPath}
      parentSchemaPath={parentSchemaPath}
      permissions={
        (docPermissions as { fields?: Record<string, never> } | undefined)?.fields ?? true
      }
    />
  )
}

/**
 * The block's layout knobs — height, alignment, media side, overlay — rendered
 * on the Layout tab. Same path contract and same RenderFields machinery as the
 * Content tab; only the field list differs, so the two cannot drift apart in
 * how they bind to form state.
 */
export function BlockLayoutFields() {
  const { fields, parentPath, parentSchemaPath, hasSelection } = useSelectedBlockFields('layout')

  // A block with no layout knobs (richText, faq…) renders nothing at all rather
  // than an empty labelled section.
  if (!hasSelection || !parentPath || fields.length === 0) return null

  return (
    <div className="nb-pb-content nb-pb-content--layout">
      <BlockContentFields
        fields={fields}
        parentPath={parentPath}
        parentSchemaPath={parentSchemaPath}
      />
    </div>
  )
}

export function BlockContentEditor() {
  const { fields, parentPath, parentSchemaPath, hasSelection } = useSelectedBlockFields('content')
  const drawerSlug = useDrawerSlug('nb-block-content')
  const { openModal } = useModal()

  if (!hasSelection) {
    return <p className="nb-pb-inspector__empty">Select a block to edit its content.</p>
  }

  // Selection and form state can be momentarily out of sync (a row removed, or
  // a just-added row not yet hydrated by getFormState) — render nothing rather
  // than another block's fields at a stale index.
  if (!parentPath || fields.length === 0) return null

  const fieldTree = (
    <BlockContentFields
      fields={fields}
      parentPath={parentPath}
      parentSchemaPath={parentSchemaPath}
    />
  )

  return (
    <div className="nb-pb-content">
      <div className="nb-pb-content__toolbar">
        <button
          type="button"
          className="nb-pb-content__expand"
          onClick={() => openModal(drawerSlug)}
        >
          Expand
        </button>
      </div>

      {fieldTree}

      {/* Same fields, wider canvas — for blocks whose arrays (FAQ items,
          floating cards) are cramped in the inspector rail. */}
      <Drawer slug={drawerSlug} title="Edit content">
        <div className="nb-pb-content nb-pb-content--drawer">{fieldTree}</div>
      </Drawer>
    </div>
  )
}
