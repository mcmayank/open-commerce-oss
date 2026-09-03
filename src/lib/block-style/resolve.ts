// src/lib/block-style/resolve.ts
import type { CSSProperties } from 'react'
import { varsForStyle, type BlockStyle } from './vocabulary'

/** The nested-group keys of `BlockStyle` (`eyebrow`, `heading`, ...). Iterated generically so a
 * new group added to the vocabulary in Task 1 needs no change here. */
type StyleGroupKey = keyof BlockStyle

/**
 * Deep-merges two `BlockStyle` layers, later wins per-field within each nested
 * group (not whole-group replacement) — so a per-instance `heading.size` and a
 * store-wide `heading.weight` both survive into the merged style. Pure: never
 * mutates either input.
 */
function mergeBlockStyle(base: BlockStyle | undefined, override: BlockStyle | undefined): BlockStyle {
  if (!base) return override ? { ...override } : {}
  if (!override) return { ...base }

  const merged: BlockStyle = { ...base }
  for (const key of Object.keys(override) as StyleGroupKey[]) {
    const overrideGroup = override[key]
    if (overrideGroup == null) continue
    const baseGroup = base[key]
    merged[key] = baseGroup ? ({ ...baseGroup, ...overrideGroup } as never) : ({ ...overrideGroup } as never)
  }
  return merged
}

/**
 * Resolves a block's final `--bs-*` CSS vars by merging three style layers,
 * later wins: theme default (none in v1) → store-wide default for `blockType`
 * → per-instance override for `blockId`. The two `BlockStyle` layers are
 * deep-merged (nested groups merge field-by-field) before being turned into
 * vars via `varsForStyle`.
 *
 * Pure and deterministic — no DB, no Payload, no React beyond the return
 * type. A `blockType` absent from `storeDefaults`, or a `blockId` absent from
 * `instanceStyles`, simply contributes nothing (no throw). Applied to each
 * block's wrapper `<div>` in `RenderBlocks`, beside `sectionVars(scheme)`.
 */
export function resolveBlockStyle(
  blockType: string,
  blockId: string,
  storeDefaults: Record<string, BlockStyle>,
  instanceStyles: Record<string, BlockStyle>,
): CSSProperties {
  const storeStyle = storeDefaults[blockType]
  const instanceStyle = instanceStyles[blockId]
  const merged = mergeBlockStyle(storeStyle, instanceStyle)
  return varsForStyle(merged) as CSSProperties
}
