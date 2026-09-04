'use client'
import * as React from 'react'
import { useField, FieldLabel } from '@payloadcms/ui'
import type { JSONFieldClientComponent } from 'payload'
import { SECTION_PRESETS } from '@/blocks/recipe/presets'

/**
 * The recipe field on a section definition. A merchant does not write a recipe —
 * they pick a starting point, and the chosen preset's recipe is copied into
 * their row. Copied, not referenced: improving a preset later must never
 * redesign a section that is already live, the same reasoning drafts encode.
 *
 * The picker also writes the sibling `presetId` text field. `presetId` cannot
 * live inside the recipe itself: `parseRecipe` (src/blocks/recipe/parse.ts)
 * rebuilds a recipe from named fields and drops any key it doesn't know, so a
 * `presetId` folded into the recipe value would be silently dropped the first
 * time the row round-trips through the write-boundary validator. Storing it as
 * its own column is what lets the "which preset did this come from" summary
 * survive a save.
 */
const SectionPresetField: JSONFieldClientComponent = ({ field, path }) => {
  const { value, setValue } = useField<unknown>({ path })
  const { value: presetId, setValue: setPresetId } = useField<string>({ path: 'presetId' })

  const label = field?.label ?? 'Layout'
  const hasRecipe = value !== null && value !== undefined
  const preset = SECTION_PRESETS.find((p) => p.id === presetId)

  if (hasRecipe) {
    return (
      <div className="field-type">
        <FieldLabel label={label} path={path} />
        <p style={{ fontSize: 13, color: 'var(--theme-text)' }}>
          {preset ? preset.name : 'Custom layout'}
        </p>
        <button
          type="button"
          onClick={() => {
            setValue(null)
            setPresetId(null)
          }}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--theme-elevation-150)',
            background: 'var(--theme-input-bg, transparent)',
            color: 'var(--theme-text)',
            cursor: 'pointer',
          }}
        >
          Choose a different layout
        </button>
      </div>
    )
  }

  return (
    <div className="field-type">
      <FieldLabel label={label} path={path} />
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {SECTION_PRESETS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => {
                setValue(p.recipe)
                setPresetId(p.id)
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 10,
                borderRadius: 8,
                border: '1px solid var(--theme-elevation-150)',
                background: 'var(--theme-input-bg, transparent)',
                cursor: 'pointer',
              }}
            >
              <strong style={{ display: 'block', color: 'var(--theme-text)' }}>{p.name}</strong>
              <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{p.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SectionPresetField
