/**
 * The label a layers-rail row shows for one block.
 *
 * Rows lead with the block's own words and carry the type as quiet metadata, so
 * the rail reads like the page rather than like a schema. Lexical rich-text
 * values are objects, not strings, and must never be stringified into the rail —
 * hence the explicit string check rather than a truthiness test.
 *
 * Pure — no React, no Payload.
 */

/**
 * Checked in order; the first non-empty string wins. Exported so callers that
 * read raw form-field state (the layers rail) can select exactly these fields
 * without duplicating the list.
 */
export const TITLE_FIELDS = ['heading', 'title', 'label', 'text', 'eyebrow'] as const

const MAX_LENGTH = 48

export function layerTitle(values: Record<string, unknown>, fallbackLabel: string): string {
  for (const key of TITLE_FIELDS) {
    const raw = values[key]
    if (typeof raw !== 'string') continue
    const clean = raw.replace(/\s+/g, ' ').trim()
    if (!clean) continue
    if (clean.length <= MAX_LENGTH) return clean
    const cut = clean.slice(0, MAX_LENGTH)
    const lastSpace = cut.lastIndexOf(' ')
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…'
  }
  return fallbackLabel
}
