import type { Payload } from 'payload'

/**
 * Cap on rows read from each source. Exceeding it understates the count, but the
 * delete guard fires on any count above zero, so a busy store fails closed rather
 * than losing a definition.
 */
const SCAN_LIMIT = 1000

/**
 * How many distinct pages reference a section definition, published or as the
 * current unpublished draft.
 *
 * Two queries, not one. With drafts enabled, an unpublished layout change lives in
 * the `_pages_v` version table, so a find over `pages` alone cannot see a page that
 * placed the definition but has not been published yet — and deleting the
 * definition would break that page the moment it is.
 *
 * The versions query is constrained to `latest: true`. `Pages` keeps up to 20
 * historical version rows per page (`maxPerDoc: 20`), and without this constraint
 * the query matches every retained row, not just the current one — so a page that
 * used the definition once and later removed it would still count for up to 20
 * more saves, refusing a delete the merchant has already made safe. `latest` gives
 * exactly "published uses it, OR the current draft uses it".
 */
export async function countPagesUsingDefinition(
  payload: Payload,
  definitionId: string | number,
): Promise<number> {
  const ids = new Set<string>()

  const current = await payload.find({
    collection: 'pages',
    where: { 'layout.definition': { equals: definitionId } },
    limit: SCAN_LIMIT,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of current.docs) ids.add(String(doc.id))

  const versions = await payload.findVersions({
    collection: 'pages',
    where: {
      and: [{ latest: { equals: true } }, { 'version.layout.definition': { equals: definitionId } }],
    },
    limit: SCAN_LIMIT,
    depth: 0,
    overrideAccess: true,
  })
  for (const version of versions.docs) {
    const parent = (version as { parent?: unknown }).parent
    if (parent !== undefined && parent !== null) ids.add(String(parent))
  }

  return ids.size
}
