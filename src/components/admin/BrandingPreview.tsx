'use client'
import * as React from 'react'
import { useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import { useThemePreset } from './useThemePreset'
import {
  buildThemeCssVars,
  presetTokens,
  resolveTokens,
  type LegacyThemeSettings,
} from '@/lib/theme-tokens'

/**
 * Live storefront preview for the StoreSettings branding fields. Reads the
 * in-progress theme values straight from the form and renders them through the
 * SAME path the storefront renders through (StoreTheme.tsx): the active
 * theme's preset underneath, via `resolveTokens(presetTokens(preset), settings)`
 * and `buildThemeCssVars` (src/lib/theme-tokens.ts), so what you see here is
 * what ships — including inheriting the theme's value when a field is unset,
 * and the safe fallback when a hex is mid-edit or invalid. The preview does
 * not load the webfont itself, so the fallback tail IS what renders here —
 * `fontFamilyAxes`/`headingFontAxes` must travel alongside the family name or
 * this diverges from the storefront for every non-sans category (serif,
 * monospace, display, handwriting); color, radius, and layout are exact.
 */
const BrandingPreview: UIFieldClientComponent = () => {
  const fields = useFormFields(([f]) => f)
  const { tokens: preset } = useThemePreset()

  const get = (path: string): string | undefined => {
    const val = fields?.[path]?.value
    return typeof val === 'string' ? val : undefined
  }
  // Axes travel as opaque JSON (see LegacyThemeSettings' doc comment) — no
  // string coercion, fontStack narrows it itself.
  const getRaw = (path: string): unknown => fields?.[path]?.value

  // The SAME path the storefront renders through (StoreTheme.tsx): the active
  // theme's preset underneath, the tenant's own settings on top. An unset field
  // must show the theme's value here exactly as it will on the live site.
  const settings: LegacyThemeSettings = {
    primaryColor: get('theme.primaryColor'),
    accentColor: get('theme.accentColor'),
    backgroundColor: get('theme.backgroundColor'),
    textColor: get('theme.textColor'),
    fontFamily: get('theme.fontFamily'),
    fontFamilyAxes: getRaw('theme.fontFamilyAxes'),
    headingFont: get('theme.headingFont'),
    headingFontAxes: getRaw('theme.headingFontAxes'),
    displayFont: get('theme.displayFont'),
    displayFontAxes: getRaw('theme.displayFontAxes'),
    headingWeight: get('theme.headingWeight'),
    bodyWeight: get('theme.bodyWeight'),
    buttonRadius: get('theme.buttonRadius'),
  }
  const vars = buildThemeCssVars(resolveTokens(presetTokens(preset), settings))
  const storeName = get('storeName') || 'Your store'

  return (
    <div style={{ marginBottom: 20 }}>
      <label className="field-label" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
        Storefront preview
      </label>

      <div
        style={{
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Browser chrome hint */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 12px',
            background: 'var(--theme-elevation-50)',
            borderBottom: '1px solid var(--theme-elevation-150)',
          }}
        >
          {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.55 }} />
          ))}
        </div>

        {/* The live storefront, driven by the tenant's own theme vars */}
        <div
          style={{
            ...(vars as React.CSSProperties),
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
            padding: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
            }}
          >
            <strong style={{ color: 'var(--color-primary)', fontSize: 18 }}>{storeName}</strong>
            <span
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-surface)',
                width: 26,
                height: 26,
                borderRadius: 'var(--radius-button)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
              }}
            >
              ⌂
            </span>
          </div>

          <div
            style={{
              border: '1px solid color-mix(in srgb, var(--color-text) 12%, transparent)',
              borderRadius: 'var(--radius-button)',
              overflow: 'hidden',
              maxWidth: 260,
            }}
          >
            <div
              style={{
                height: 110,
                background: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))',
              }}
            />
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Sample product</div>
              <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 12 }}>$24.00</div>
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: 'none',
                  borderRadius: 'var(--radius-button)',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Add to cart
              </button>
            </div>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, opacity: 0.7, margin: '6px 0 0' }}>
        Updates live as you edit colors, font, and button style above. Save to apply to your store.
      </p>
    </div>
  )
}

export default BrandingPreview
