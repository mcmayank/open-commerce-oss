/**
 * Where a style control's current value comes from.
 *
 * The panel showed "Default" for every unset control, which could mean the
 * theme's value, a store-wide default for this block type, a `var()` fallback
 * the block hardcodes, or nothing at all — four different things behind one
 * word, and no way to see at a glance what you yourself had changed.
 *
 * The cascade is theme -> store default -> this instance. The store layer is
 * `blockStyleDefaults[blockType]`; the instance layer is
 * `block_styles[blockId]`. Pure — no React, no Payload.
 */

import { BLOCK_STYLE_VOCAB, type BlockStyle } from './vocabulary'
import { getControlValue, type StyleGroupKey } from './panel'

export type ControlOrigin =
  | { kind: 'instance'; value: string; label: string }
  | { kind: 'store'; value: string; label: string }
  | { kind: 'theme' }

type AnyControl = { options: { label: string; value: string }[] }

export function optionLabel(
  group: StyleGroupKey,
  control: string,
  value: string,
): string | undefined {
  const controls = BLOCK_STYLE_VOCAB[group] as unknown as Record<string, AnyControl>
  return controls[control]?.options.find((o) => o.value === value)?.label
}

export function resolveControlOrigin(
  instance: BlockStyle,
  store: BlockStyle,
  group: StyleGroupKey,
  control: string,
): ControlOrigin {
  const own = getControlValue(instance, group, control)
  if (own) return { kind: 'instance', value: own, label: optionLabel(group, control, own) ?? own }

  const inherited = getControlValue(store, group, control)
  if (inherited) {
    return {
      kind: 'store',
      value: inherited,
      label: optionLabel(group, control, inherited) ?? inherited,
    }
  }

  return { kind: 'theme' }
}

export function countGroupOverrides(instance: BlockStyle, group: StyleGroupKey): number {
  const values = instance[group] as Record<string, string | undefined> | undefined
  if (!values) return 0
  return Object.values(values).filter((v) => typeof v === 'string' && v !== '').length
}

export function countOverrides(instance: BlockStyle, groups: StyleGroupKey[]): number {
  return groups.reduce((sum, g) => sum + countGroupOverrides(instance, g), 0)
}
