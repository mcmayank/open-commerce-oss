'use client'
import * as React from 'react'
import { useField } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import { useThemePreset } from './useThemePreset'
import type { ThemeTokens } from '@/lib/theme-tokens'

/**
 * Color-picker Field for the StoreSettings hex-color text fields (primaryColor,
 * accentColor, …). Replaces the raw text input with a native swatch + hex input
 * kept in sync. The stored value stays a hex string, so `resolveTokens` /
 * `buildThemeCssVars` (src/lib/theme-tokens.ts) and their validation contract
 * are unchanged — an invalid hex still falls back to the theme's token on the
 * storefront; here we just flag it inline.
 */

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * Which preset token each branding field inherits when left empty. Mirrors
 * `resolveTokens` (src/lib/theme-tokens.ts) — if these disagree, the admin
 * shows a colour the storefront will not render. Exported so ColorField.test
 * can pin it against the real `resolveTokens` rather than a mocked preset.
 */
export const INHERITS: Record<string, keyof ThemeTokens> = {
  primaryColor: 'colorPrimary',
  accentColor: 'colorAccent',
  backgroundColor: 'colorSurface',
  textColor: 'colorText',
}

/** Expand #rgb → #rrggbb so the native <input type="color"> can display it. */
function toSwatch(v: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
  const m = v.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/)
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`
  return '#000000'
}

function labelText(label: unknown, fallback: string): string {
  if (typeof label === 'string' && label) return label
  return fallback
}

const ColorField: TextFieldClientComponent = ({ field, path }) => {
  const { value, setValue } = useField<string>({ path })
  const v = value ?? ''
  const valid = v === '' || HEX.test(v)
  const label = labelText(field?.label, field?.name ?? path)
  const desc = typeof field?.admin?.description === 'string' ? field.admin.description : undefined

  const { tokens } = useThemePreset()
  const tokenKey = INHERITS[String(field?.name ?? '')]
  const inheritedRaw = tokens && tokenKey ? String(tokens[tokenKey] ?? '') : ''
  const inherited = HEX.test(inheritedRaw) ? inheritedRaw : ''
  const isInheriting = v === ''

  return (
    <div className="field-type text" style={{ marginBottom: 20 }}>
      <label className="field-label" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          aria-label={`${label} swatch`}
          value={toSwatch(isInheriting ? inherited || '#ffffff' : v)}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: 40,
            height: 38,
            padding: 2,
            border: isInheriting
              ? '2px dashed var(--theme-elevation-250)'
              : '1px solid var(--theme-elevation-150)',
            borderRadius: 8,
            background: 'var(--theme-input-bg, transparent)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          inputMode="text"
          spellCheck={false}
          value={v}
          // No hex fallback here: while the preset is in flight the only honest
          // placeholder is the word, not the platform default this branch
          // exists to stop merchants inheriting by accident.
          placeholder={inherited || 'From your theme'}
          onChange={(e) => setValue(e.target.value)}
          style={{
            flex: 1,
            maxWidth: 180,
            padding: '8px 10px',
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            border: `1px solid ${valid ? 'var(--theme-elevation-150)' : 'var(--theme-error-500, #d14343)'}`,
            borderRadius: 8,
            background: 'var(--theme-input-bg, transparent)',
            color: 'var(--theme-text)',
          }}
        />
        {isInheriting ? (
          <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
            From your theme{inherited ? ` (${inherited})` : ''}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setValue('')}
            style={{
              fontSize: 12,
              background: 'none',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              color: 'var(--theme-elevation-600)',
              textDecoration: 'underline',
            }}
          >
            Reset to theme
          </button>
        )}
      </div>
      {desc && <p style={{ fontSize: 12, opacity: 0.7, margin: '6px 0 0' }}>{desc}</p>}
      {!valid && (
        <p style={{ fontSize: 12, color: 'var(--theme-error-500, #d14343)', margin: '6px 0 0' }}>
          Enter a valid hex color, e.g. #2563eb.
        </p>
      )}
    </div>
  )
}

export default ColorField
