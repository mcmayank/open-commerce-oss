import React from 'react'
import { headers } from 'next/headers'
import {
  buildThemeCssVars,
  presetTokens,
  resolveTokens,
  type LegacyThemeSettings,
  type ThemeTokens,
} from '@/lib/theme-tokens'
import { buildFontHref } from '@/lib/fonts/url'
import type { FontAxes, FontSlot } from '@/lib/fonts/types'
import type { StoreSetting } from '@/payload-types'

/**
 * Narrow an `unknown` axes snapshot to `FontAxes` at this component's
 * boundary — the same problem `categoryOf` (src/lib/theme-tokens.ts) solves
 * for the CSS fallback tail, except resolved as a guard instead of a default:
 * `buildFontHref` needs the real variable/weights data to build a correct
 * URL, so a malformed axes value has to drop the whole slot rather than
 * quietly degrade. Not a second validation layer — the shape was already
 * checked by src/lib/fonts/validate.ts at save time; this only stops a
 * legacy or unshapely row from producing a broken font URL, the same trust
 * boundary theme-tokens.ts draws for the same `unknown` column.
 */
function isFontAxes(axes: unknown): axes is FontAxes {
  if (!axes || typeof axes !== 'object' || Array.isArray(axes)) return false
  const a = axes as Record<string, unknown>
  if (typeof a.hasItalic !== 'boolean') return false
  if (a.variable === true) return Number.isFinite(a.min) && Number.isFinite(a.max)
  if (a.variable === false) return Array.isArray(a.weights)
  return false
}

/**
 * Reads the per-request nonce set by src/proxy.ts. Wrapped because headers()
 * throws outside a request scope (e.g. a unit test that renders this
 * component directly, with no request context) — that must yield `undefined`
 * rather than blow up the render, same as a request that genuinely has no
 * `x-nonce` header.
 */
async function readNonce(): Promise<string | undefined> {
  try {
    return (await headers()).get('x-nonce') ?? undefined
  } catch {
    return undefined
  }
}

interface StoreThemeProps {
  settings?: StoreSetting | null
  /** Active theme's token preset (Slice E). Layered under the tenant's own settings. */
  preset?: Partial<ThemeTokens> | null
}

/**
 * Server component that injects per-tenant CSS variables onto :root.
 * Renders a <style> tag — safe per request (one tenant per response).
 * Values are hex strings or CSS lengths derived from enum tokens, not user HTML.
 *
 * Emits the full theme-token set (colors, fonts, spacing, radius, shadow). The
 * six legacy vars keep their exact values, so this is visually a no-op until the
 * shared blocks/components adopt the new tokens in later slices.
 */
export default async function StoreTheme({ settings, preset }: StoreThemeProps) {
  const nonce = await readNonce()
  const theme = settings?.theme as LegacyThemeSettings

  // Base = the active theme's preset over the defaults; then the tenant's own
  // color/font settings win on top, so per-store customization always applies.
  const tokens = resolveTokens(presetTokens(preset), theme)
  const vars = buildThemeCssVars(tokens)

  const cssVarDecls = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')

  // Optional theme-driven type weights: force body / headings to a consistent
  // weight (overriding block utility classes, since this <style> is unlayered).
  const bodyWeight = tokens.fontBodyWeight ? `\n  font-weight: ${tokens.fontBodyWeight};` : ''
  // Headings take the heading font here rather than inline on every block, so a
  // merchant's custom CSS (docs/THEMING-HOOKS.md) can override it without
  // fighting an inline style. Weight stays conditional — absent means "inherit".
  const headingWeight = tokens.fontHeadingWeight ? `\n  font-weight: ${tokens.fontHeadingWeight};` : ''
  const headingRule = `\nh1, h2, h3, h4, h5, h6 {\n  font-family: var(--font-heading, var(--font-body));${headingWeight}\n}`

  const css = `:root {\n${cssVarDecls}\n}\nbody {\n  font-family: var(--font-body);\n  background: var(--color-surface);\n  color: var(--color-text);${bodyWeight}\n}${headingRule}`

  /**
   * The per-store font request. Built from the axes snapshot persisted on the
   * tenant, so this render path makes no network call and never consults the
   * catalog cache — a store keeps rendering correctly even if the family later
   * leaves Google's catalog.
   *
   * `system` and unset both resolve to no slot, which is what lets a store on
   * the native stack ship zero font bytes.
   */
  const slots: FontSlot[] = []
  for (const [family, axes] of [
    [theme?.fontFamily, theme?.fontFamilyAxes],
    [theme?.headingFont, theme?.headingFontAxes],
    [theme?.displayFont, theme?.displayFontAxes],
  ] as const) {
    if (typeof family === 'string' && family && family !== 'system' && isFontAxes(axes)) {
      slots.push({ family, axes })
    }
  }
  const fontHref = buildFontHref(slots)

  return (
    <>
      {/*
        Deliberately no `precedence` prop. That would opt into React 19's
        stylesheet-resource handling, which hoists to <head> and blocks render
        until the sheet loads — exactly wrong for a display=swap font, whose
        whole point is that text paints immediately in the fallback. Rendering
        in place matches the <style> beside it.
      */}
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      <style nonce={nonce} dangerouslySetInnerHTML={{ __html: css }} />
    </>
  )
}
