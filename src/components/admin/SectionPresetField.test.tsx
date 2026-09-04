// @vitest-environment jsdom
import * as React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { SECTION_PRESETS } from '@/blocks/recipe/presets'
import { parseRecipe } from '@/blocks/recipe/parse'

/**
 * Mirrors VariantOptionValues.test.tsx's mock of `@payloadcms/ui`: a fake
 * `useField` keyed by `path`, so the same component instance can independently
 * read/write the `recipe` field it's rendered for and the sibling `presetId`
 * field it also owns.
 */
let recipeValue: unknown = null
let presetIdValue: string | null = null
const setRecipeValue = vi.fn((v: unknown) => {
  recipeValue = v
})
const setPresetIdValue = vi.fn((v: string | null) => {
  presetIdValue = v
})

vi.mock('@payloadcms/ui', () => ({
  useField: ({ path }: { path: string }) =>
    path === 'presetId'
      ? { value: presetIdValue, setValue: setPresetIdValue }
      : { value: recipeValue, setValue: setRecipeValue },
  FieldLabel: ({ label }: { label: string }) => <span>{label}</span>,
}))

const mod = await import('./SectionPresetField')
const SectionPresetField = mod.default as unknown as React.FC<{
  field: { label?: string }
  path: string
}>

beforeEach(() => {
  recipeValue = null
  presetIdValue = null
  setRecipeValue.mockClear()
  setPresetIdValue.mockClear()
})

afterEach(cleanup)

describe('SectionPresetField', () => {
  it('renders one button per preset when no recipe is chosen yet', () => {
    render(<SectionPresetField field={{ label: 'Layout' }} path="recipe" />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(SECTION_PRESETS.length)
    for (const preset of SECTION_PRESETS) {
      expect(screen.getByText(preset.name)).toBeTruthy()
    }
  })

  it('writes a preset recipe that parseRecipe accepts, and records the preset id', () => {
    render(<SectionPresetField field={{ label: 'Layout' }} path="recipe" />)
    const chosen = SECTION_PRESETS[0]!
    screen.getByText(chosen.name).closest('button')!.click()

    expect(setRecipeValue).toHaveBeenCalledTimes(1)
    const written = setRecipeValue.mock.calls[0]![0]
    expect(() => parseRecipe(written)).not.toThrow()
    expect(written).toEqual(chosen.recipe)

    expect(setPresetIdValue).toHaveBeenCalledWith(chosen.id)
  })

  it('renders the chosen preset name and hides the picker once a recipe is set', () => {
    const chosen = SECTION_PRESETS[1]!
    recipeValue = chosen.recipe
    presetIdValue = chosen.id

    render(<SectionPresetField field={{ label: 'Layout' }} path="recipe" />)

    expect(screen.getByText(chosen.name)).toBeTruthy()
    expect(screen.queryByText(SECTION_PRESETS[0]!.description)).toBeNull()
    expect(screen.getByText('Choose a different layout')).toBeTruthy()
  })

  it('clears both the recipe and the preset id when choosing a different layout', () => {
    const chosen = SECTION_PRESETS[0]!
    recipeValue = chosen.recipe
    presetIdValue = chosen.id

    render(<SectionPresetField field={{ label: 'Layout' }} path="recipe" />)
    screen.getByText('Choose a different layout').click()

    expect(setRecipeValue).toHaveBeenCalledWith(null)
    expect(setPresetIdValue).toHaveBeenCalledWith(null)
  })

  // Both states below are real, not hypothetical: a definition hand-written
  // before this field existed has a recipe but no presetId at all, and a
  // presetId can outlive the preset it named if a preset is later removed or
  // renamed (preset ids are code; rows are data that outlives a deploy). Either
  // way the merchant must still get a coherent summary and a way out, not a
  // crash or a blank name.
  it('falls back to "Custom layout" when a recipe exists but presetId was never set', () => {
    recipeValue = SECTION_PRESETS[0]!.recipe
    presetIdValue = null

    render(<SectionPresetField field={{ label: 'Layout' }} path="recipe" />)

    expect(screen.getByText('Custom layout')).toBeTruthy()
    expect(screen.getByText('Choose a different layout')).toBeTruthy()
  })

  it('falls back to "Custom layout" when presetId no longer names a known preset', () => {
    recipeValue = SECTION_PRESETS[0]!.recipe
    presetIdValue = 'aRetiredPreset'

    render(<SectionPresetField field={{ label: 'Layout' }} path="recipe" />)

    expect(screen.getByText('Custom layout')).toBeTruthy()
    expect(screen.getByText('Choose a different layout')).toBeTruthy()
  })
})
