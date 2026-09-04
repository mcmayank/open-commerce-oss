/**
 * Single source of truth for the block style vocabulary — every control, its
 * enum options, and each option's `--bs-*` CSS-var value. Consumed by the
 * resolver (Task 2), the admin Style panel (Task 6/7), and tests. Do not
 * duplicate an option or a var value anywhere else; add it here first.
 *
 * Pure and side-effect-free: no DB, no Payload, no React. `varsForStyle` only
 * emits vars for controls the caller actually set — an unset control means
 * "inherit the block's existing default", expressed downstream as
 * `var(--bs-heading-size, <existing-default>)`. Never emit a var for an
 * unset control.
 *
 * Text colour is deliberately NOT here — it stays scheme/`--section-*`/
 * accent-token governed so contrast safety isn't defeated by a free-form
 * style control. See docs/superpowers/specs/2026-08-17-block-style-system-design.md §3/§8.
 */

/** One selectable value for a control: the admin-facing label and the raw value stored on the style object. */
export type VocabOption<V extends string = string> = {
  label: string
  value: V
}

/** A single control: its options plus the function that turns a chosen value into a `--bs-*` var entry. */
export type VocabControl<V extends string = string> = {
  /** The options an admin UI renders for this control, in display order. */
  options: VocabOption<V>[]
  /** The `--bs-*` custom property this control writes. */
  cssVar: string
  /** Maps a chosen option value to the CSS value written to `cssVar`. */
  toCssValue: (value: V) => string
}

/**
 * A control whose selection can't be expressed as one CSS value, because the
 * choice is structural (it changes box model / layout, not just a property
 * value) — e.g. eyebrow `treatment` (pill vs plain needs background/padding/
 * radius together) and media `layout` (inset vs full-bleed needs padding and
 * an implied radius together). One option maps to a small bundle of `--bs-*`
 * vars instead of a single one; the consuming block composes them with plain
 * CSS (nested `var()` fallbacks or several utility classes), never JS
 * branching — the block still never sees the raw enum value, only vars.
 */
export type MultiVocabControl<V extends string = string> = {
  /** The options an admin UI renders for this control, in display order. */
  options: VocabOption<V>[]
  /** Every `--bs-*` custom property this control can write (for docs/introspection). */
  cssVars: string[]
  /** Maps a chosen option value to the full set of vars it writes. */
  toCssValues: (value: V) => Record<string, string>
}

// ---------------------------------------------------------------------------
// Shared option scales (typography)
// ---------------------------------------------------------------------------

/**
 * Sizes are FLUID above `lg`, and that is load-bearing rather than stylistic.
 *
 * Blocks consume this var at both breakpoints from one declaration —
 * `text-[length:var(--bs-heading-size,1.5rem)] sm:text-[length:var(--bs-heading-size,…)]`
 * — so both branches read the SAME variable. The moment a merchant sets a size,
 * the block stops being responsive. That was survivable while the scale stopped
 * at 3rem; at 7XL a fixed 8rem is 128px on a 390px phone and overflows the
 * viewport horizontally. `clamp(min, vw, max)` makes one chosen size correct on
 * every screen, so the merchant picks "7XL" and never has to think about it.
 *
 * The maxima are unchanged where they already existed, so desktop rendering of
 * an already-stored size does not move: 3XL still resolves to 3rem at any
 * viewport wide enough to reach it. Only phones change, and only by shrinking
 * type that would otherwise have overflowed.
 *
 * Below `xl` the values stay fixed: eyebrows and body copy are small enough
 * that viewport scaling buys nothing and costs predictability.
 */
const SIZE_CSS: Record<TextSizeValue, string> = {
  xs: '.75rem',
  sm: '.875rem',
  base: '1.0625rem',
  lg: '1.375rem',
  xl: 'clamp(1.5rem, 3vw, 1.875rem)',
  '2xl': 'clamp(1.625rem, 3.75vw, 2.25rem)',
  '3xl': 'clamp(1.75rem, 4.5vw, 3rem)',
  '4xl': 'clamp(2rem, 5.5vw, 3.75rem)',
  '5xl': 'clamp(2rem, 6vw, 4.5rem)',
  '6xl': 'clamp(2.25rem, 7vw, 6rem)',
  '7xl': 'clamp(2.5rem, 8vw, 8rem)',
}

const SIZE_LABELS: Record<TextSizeValue, string> = {
  xs: 'XS',
  sm: 'Small',
  base: 'Base',
  lg: 'Large',
  xl: 'XL',
  '2xl': '2XL',
  '3xl': '3XL',
  '4xl': '4XL',
  '5xl': '5XL',
  '6xl': '6XL',
  '7xl': '7XL',
}

const WEIGHT_LABELS: Record<TextWeightValue, string> = {
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'Semibold',
  '700': 'Bold',
  '800': 'Extrabold',
}

const sizes = (...values: TextSizeValue[]): VocabOption<TextSizeValue>[] =>
  values.map((value) => ({ label: SIZE_LABELS[value], value }))

const weights = (...values: TextWeightValue[]): VocabOption<TextWeightValue>[] =>
  values.map((value) => ({ label: WEIGHT_LABELS[value], value }))

/**
 * Each text role gets its OWN scale, because one shared scale offered every
 * role the whole range and most of it was wrong for that role.
 *
 * A heading starting at XS was the clearest symptom — nobody sets a heading to
 * 12px — but the inverse mattered too: a subheading could be set to display
 * sizes, and an eyebrow to Extrabold, neither of which is a thing anyone wants.
 * Narrowing each list is what makes the remaining options meaningful.
 *
 * Removing a value from a list does NOT stop it rendering. `SIZE_CSS` above
 * still maps every value, and weight's `toCssValue` is the identity, so a page
 * that already stored `heading.size: 'sm'` keeps rendering exactly as before —
 * it simply cannot be chosen again. That matters: the alternative, dropping the
 * CSS entry too, emits `--bs-heading-size: undefined` on live pages.
 */
const HEADING_SIZE_OPTIONS = sizes('xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl')
/** Eyebrows are small caps labels; anything above `lg` is a heading wearing a hat. */
const EYEBROW_SIZE_OPTIONS = sizes('xs', 'sm', 'base', 'lg')
/** Subheadings are body copy: never display-sized, never as small as an eyebrow. */
const SUBHEADING_SIZE_OPTIONS = sizes('sm', 'base', 'lg', 'xl')

/**
 * Weights are pruned to steps that are actually distinguishable in the role.
 *
 * The old list ran 400/500/600/700/800 for every role, where 400 and 500 differ
 * imperceptibly at heading sizes and 700 vs 800 is a cut most webfonts
 * synthesise rather than ship. Headings keep Semibold over Medium (600 is a
 * real step up from Regular) and Bold over Extrabold (700 is the weight fonts
 * actually have).
 */
const HEADING_WEIGHT_OPTIONS = weights('300', '400', '600', '700')
/** No Light: at 12-14px uppercase it is illegible. No Bold: an eyebrow should not shout. */
const EYEBROW_WEIGHT_OPTIONS = weights('400', '500', '600')
/** Body copy. Above Medium stops reading as prose. */
const SUBHEADING_WEIGHT_OPTIONS = weights('300', '400', '500')

const FONT_OPTIONS: VocabOption<FontRoleValue>[] = [
  { label: 'Heading', value: 'heading' },
  { label: 'Body', value: 'body' },
  { label: 'Display', value: 'display' },
]

const FONT_CSS: Record<FontRoleValue, string> = {
  heading: 'var(--font-heading)',
  body: 'var(--font-body)',
  display: 'var(--font-display)',
}

const TRACKING_OPTIONS: VocabOption<TrackingValue>[] = [
  { label: 'Tight', value: 'tight' },
  { label: 'Normal', value: 'normal' },
  { label: 'Wide', value: 'wide' },
]

const TRACKING_CSS: Record<TrackingValue, string> = {
  tight: '-0.02em',
  normal: '0',
  wide: '0.14em',
}

const ON_OFF_OPTIONS: VocabOption<OnOffValue>[] = [
  { label: 'On', value: 'on' },
  { label: 'Off', value: 'off' },
]

const SIZE_OPTIONS_BY_ELEMENT = {
  eyebrow: EYEBROW_SIZE_OPTIONS,
  heading: HEADING_SIZE_OPTIONS,
  subheading: SUBHEADING_SIZE_OPTIONS,
} as const

const WEIGHT_OPTIONS_BY_ELEMENT = {
  eyebrow: EYEBROW_WEIGHT_OPTIONS,
  heading: HEADING_WEIGHT_OPTIONS,
  subheading: SUBHEADING_WEIGHT_OPTIONS,
} as const

/** Builds the typography control set shared by eyebrow/heading/subheading, scoped to `--bs-<element>-*`. */
function typographyControls(element: 'eyebrow' | 'heading' | 'subheading') {
  return {
    size: {
      options: SIZE_OPTIONS_BY_ELEMENT[element],
      cssVar: `--bs-${element}-size`,
      toCssValue: (value: TextSizeValue) => SIZE_CSS[value],
    } satisfies VocabControl<TextSizeValue>,
    weight: {
      options: WEIGHT_OPTIONS_BY_ELEMENT[element],
      cssVar: `--bs-${element}-weight`,
      toCssValue: (value: TextWeightValue) => value,
    } satisfies VocabControl<TextWeightValue>,
    font: {
      options: FONT_OPTIONS,
      cssVar: `--bs-${element}-font`,
      toCssValue: (value: FontRoleValue) => FONT_CSS[value],
    } satisfies VocabControl<FontRoleValue>,
    tracking: {
      options: TRACKING_OPTIONS,
      cssVar: `--bs-${element}-tracking`,
      toCssValue: (value: TrackingValue) => TRACKING_CSS[value],
    } satisfies VocabControl<TrackingValue>,
    uppercase: {
      options: ON_OFF_OPTIONS,
      cssVar: `--bs-${element}-transform`,
      toCssValue: (value: OnOffValue) => (value === 'on' ? 'uppercase' : 'none'),
    } satisfies VocabControl<OnOffValue>,
    italic: {
      options: ON_OFF_OPTIONS,
      cssVar: `--bs-${element}-style`,
      toCssValue: (value: OnOffValue) => (value === 'on' ? 'italic' : 'normal'),
    } satisfies VocabControl<OnOffValue>,
  }
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

const RADIUS_OPTIONS: VocabOption<MediaRadiusValue>[] = [
  { label: 'None', value: 'none' },
  { label: 'Small', value: 'sm' },
  { label: 'Medium', value: 'md' },
  { label: 'Large', value: 'lg' },
  { label: 'Full', value: 'full' },
]

const RADIUS_CSS: Record<MediaRadiusValue, string> = {
  none: '0',
  sm: '.375rem',
  md: '.875rem',
  lg: '1.5rem',
  full: '9999px',
}

const SHADOW_OPTIONS: VocabOption<MediaShadowValue>[] = [
  { label: 'None', value: 'none' },
  { label: 'Small', value: 'sm' },
  { label: 'Medium', value: 'md' },
  { label: 'Large', value: 'lg' },
]

/**
 * Reconciled against the approved mockup (Task 8) — these three values are
 * the mockup's literal box-shadow strings, not the implementer-chosen values
 * Task 1 shipped with. 'none' is unaffected.
 */
const SHADOW_CSS: Record<MediaShadowValue, string> = {
  none: 'none',
  sm: '0 2px 6px rgba(30,25,15,.14)',
  md: '0 12px 26px -10px rgba(30,25,15,.35)',
  lg: '0 26px 50px -16px rgba(30,25,15,.5)',
}

const MEDIA_LAYOUT_OPTIONS: VocabOption<MediaLayoutValue>[] = [
  { label: 'Inset', value: 'inset' },
  { label: 'Full bleed', value: 'full-bleed' },
]

/**
 * `layout` is structural — "inset" vs "full-bleed" can't be expressed as one
 * CSS value, it changes the media wrapper's box model (padding that reveals
 * a frame) as well as a baseline corner radius. So this control is a
 * `MultiVocabControl`: one choice emits a small bundle of vars instead of a
 * single one. `--bs-media-layout-radius` is only the *implied* radius for
 * the layout — the independent `media.radius` control still wins when a
 * merchant sets it explicitly (the component nests the fallback:
 * `var(--bs-media-radius, var(--bs-media-layout-radius, 0))`).
 */
const MEDIA_LAYOUT_CSS: Record<MediaLayoutValue, Record<string, string>> = {
  inset: {
    '--bs-media-layout-pad': '1.5rem',
    '--bs-media-layout-radius': '1.5rem',
  },
  'full-bleed': {
    '--bs-media-layout-pad': '0',
    '--bs-media-layout-radius': '0',
  },
}

const MEDIA_BLEND_OPTIONS: VocabOption<MediaBlendValue>[] = [
  { label: 'None', value: 'none' },
  { label: 'Multiply', value: 'multiply' },
  { label: 'Overlay', value: 'overlay' },
]

const MEDIA_BLEND_CSS: Record<MediaBlendValue, string> = {
  none: 'normal',
  multiply: 'multiply',
  overlay: 'overlay',
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

const SECTION_DENSITY_OPTIONS: VocabOption<SectionDensityValue>[] = [
  { label: 'Compact', value: 'compact' },
  { label: 'Normal', value: 'normal' },
  { label: 'Spacious', value: 'spacious' },
]

const SECTION_DENSITY_CSS: Record<SectionDensityValue, string> = {
  compact: '2.5rem',
  normal: '4rem',
  spacious: '6rem',
}

const SECTION_WIDTH_OPTIONS: VocabOption<SectionWidthValue>[] = [
  { label: 'Narrow', value: 'narrow' },
  { label: 'Normal', value: 'normal' },
  { label: 'Wide', value: 'wide' },
]

const SECTION_WIDTH_CSS: Record<SectionWidthValue, string> = {
  narrow: '48rem',
  normal: '72rem',
  wide: '88rem',
}

// ---------------------------------------------------------------------------
// Heading accent span
// ---------------------------------------------------------------------------

const ACCENT_FONT_OPTIONS: VocabOption<AccentFontValue>[] = [
  { label: 'Heading', value: 'heading' },
  { label: 'Display', value: 'display' },
]

const ACCENT_FONT_CSS: Record<AccentFontValue, string> = {
  heading: 'var(--font-heading)',
  display: 'var(--font-display)',
}

const ACCENT_COLOR_OPTIONS: VocabOption<AccentColorValue>[] = [
  { label: 'Inherit', value: 'inherit' },
  { label: 'Primary', value: 'primary' },
  { label: 'Accent', value: 'accent' },
]

const ACCENT_COLOR_CSS: Record<AccentColorValue, string> = {
  inherit: 'inherit',
  primary: 'var(--color-primary)',
  accent: 'var(--color-accent)',
}

// ---------------------------------------------------------------------------
// Eyebrow treatment (structural — see MultiVocabControl doc comment)
// ---------------------------------------------------------------------------

const EYEBROW_TREATMENT_OPTIONS: VocabOption<EyebrowTreatmentValue>[] = [
  { label: 'Pill', value: 'pill' },
  { label: 'Plain caps', value: 'plain-caps' },
  { label: 'Plain', value: 'plain' },
]

/**
 * `treatment` bundles the pill's whole chrome — background, padding, corner
 * radius — plus the implied text-transform for that treatment. The bundle
 * deliberately does NOT include a text colour: colour stays scheme/token
 * governed (§8), so the pill reuses whatever colour class the eyebrow
 * already renders with rather than the vocabulary picking one.
 *
 * `--bs-eyebrow-treatment-transform` is a distinct var from the generic
 * typography `--bs-eyebrow-transform` (the plain on/off uppercase toggle) so
 * the two controls never fight over the same custom property — the
 * component nests them (`var(--bs-eyebrow-transform, var(--bs-eyebrow-
 * treatment-transform, uppercase))`), letting an explicit generic toggle win
 * over the treatment's implied default, which in turn wins over today's
 * hard-coded default.
 */
const EYEBROW_TREATMENT_CSS: Record<EyebrowTreatmentValue, Record<string, string>> = {
  pill: {
    '--bs-eyebrow-treatment-bg': 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))',
    '--bs-eyebrow-treatment-pad': '.375rem .875rem',
    '--bs-eyebrow-treatment-radius': '9999px',
    '--bs-eyebrow-treatment-transform': 'uppercase',
  },
  'plain-caps': {
    '--bs-eyebrow-treatment-bg': 'transparent',
    '--bs-eyebrow-treatment-pad': '0',
    '--bs-eyebrow-treatment-radius': '0',
    '--bs-eyebrow-treatment-transform': 'uppercase',
  },
  plain: {
    '--bs-eyebrow-treatment-bg': 'transparent',
    '--bs-eyebrow-treatment-pad': '0',
    '--bs-eyebrow-treatment-radius': '0',
    '--bs-eyebrow-treatment-transform': 'none',
  },
}

// ---------------------------------------------------------------------------
// Value unions (also used as the stored `BlockStyle` field types)
// ---------------------------------------------------------------------------

export type TextSizeValue =
  | 'xs'
  | 'sm'
  | 'base'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'
  | '7xl'
export type TextWeightValue = '300' | '400' | '500' | '600' | '700' | '800'
export type FontRoleValue = 'heading' | 'body' | 'display'
export type TrackingValue = 'tight' | 'normal' | 'wide'
export type OnOffValue = 'on' | 'off'
export type EyebrowTreatmentValue = 'pill' | 'plain-caps' | 'plain'

export type AccentFontValue = 'heading' | 'display'
export type AccentColorValue = 'inherit' | 'primary' | 'accent'

export type MediaRadiusValue = 'none' | 'sm' | 'md' | 'lg' | 'full'
export type MediaShadowValue = 'none' | 'sm' | 'md' | 'lg'
export type MediaLayoutValue = 'inset' | 'full-bleed'
export type MediaBlendValue = 'none' | 'multiply' | 'overlay'

export type SectionDensityValue = 'compact' | 'normal' | 'spacious'
export type SectionWidthValue = 'narrow' | 'normal' | 'wide'

// ---------------------------------------------------------------------------
// BLOCK_STYLE_VOCAB — the control catalog
// ---------------------------------------------------------------------------

export const BLOCK_STYLE_VOCAB = {
  eyebrow: {
    ...typographyControls('eyebrow'),
    treatment: {
      options: EYEBROW_TREATMENT_OPTIONS,
      cssVars: [
        '--bs-eyebrow-treatment-bg',
        '--bs-eyebrow-treatment-pad',
        '--bs-eyebrow-treatment-radius',
        '--bs-eyebrow-treatment-transform',
      ],
      toCssValues: (value: EyebrowTreatmentValue) => EYEBROW_TREATMENT_CSS[value],
    } satisfies MultiVocabControl<EyebrowTreatmentValue>,
  },
  heading: typographyControls('heading'),
  subheading: typographyControls('subheading'),
  accent: {
    font: {
      options: ACCENT_FONT_OPTIONS,
      cssVar: '--bs-accent-font',
      toCssValue: (value: AccentFontValue) => ACCENT_FONT_CSS[value],
    } satisfies VocabControl<AccentFontValue>,
    color: {
      options: ACCENT_COLOR_OPTIONS,
      cssVar: '--bs-accent-color',
      toCssValue: (value: AccentColorValue) => ACCENT_COLOR_CSS[value],
    } satisfies VocabControl<AccentColorValue>,
    italic: {
      options: ON_OFF_OPTIONS,
      cssVar: '--bs-accent-style',
      toCssValue: (value: OnOffValue) => (value === 'on' ? 'italic' : 'normal'),
    } satisfies VocabControl<OnOffValue>,
  },
  media: {
    radius: {
      options: RADIUS_OPTIONS,
      cssVar: '--bs-media-radius',
      toCssValue: (value: MediaRadiusValue) => RADIUS_CSS[value],
    } satisfies VocabControl<MediaRadiusValue>,
    shadow: {
      options: SHADOW_OPTIONS,
      cssVar: '--bs-media-shadow',
      toCssValue: (value: MediaShadowValue) => SHADOW_CSS[value],
    } satisfies VocabControl<MediaShadowValue>,
    layout: {
      options: MEDIA_LAYOUT_OPTIONS,
      cssVars: ['--bs-media-layout-pad', '--bs-media-layout-radius'],
      toCssValues: (value: MediaLayoutValue) => MEDIA_LAYOUT_CSS[value],
    } satisfies MultiVocabControl<MediaLayoutValue>,
    blend: {
      options: MEDIA_BLEND_OPTIONS,
      cssVar: '--bs-media-blend',
      toCssValue: (value: MediaBlendValue) => MEDIA_BLEND_CSS[value],
    } satisfies VocabControl<MediaBlendValue>,
  },
  section: {
    density: {
      options: SECTION_DENSITY_OPTIONS,
      cssVar: '--bs-section-pad',
      toCssValue: (value: SectionDensityValue) => SECTION_DENSITY_CSS[value],
    } satisfies VocabControl<SectionDensityValue>,
    width: {
      options: SECTION_WIDTH_OPTIONS,
      cssVar: '--bs-section-width',
      toCssValue: (value: SectionWidthValue) => SECTION_WIDTH_CSS[value],
    } satisfies VocabControl<SectionWidthValue>,
  },
} as const

// ---------------------------------------------------------------------------
// BlockStyle — the stored nested-optional shape
// ---------------------------------------------------------------------------

/** Typography controls shared by eyebrow, heading, and subheading. All optional — unset means "use the block default". */
type TypographyStyle = {
  size?: TextSizeValue
  weight?: TextWeightValue
  font?: FontRoleValue
  tracking?: TrackingValue
  uppercase?: OnOffValue
  italic?: OnOffValue
}

type EyebrowStyle = TypographyStyle & {
  treatment?: EyebrowTreatmentValue
}

type AccentStyle = {
  font?: AccentFontValue
  color?: AccentColorValue
  italic?: OnOffValue
}

type MediaStyle = {
  radius?: MediaRadiusValue
  shadow?: MediaShadowValue
  layout?: MediaLayoutValue
  blend?: MediaBlendValue
}

type SectionStyle = {
  density?: SectionDensityValue
  width?: SectionWidthValue
}

/**
 * The stored shape of a single block's style overrides — everything is
 * optional at every level, since an admin may set only a handful of
 * controls. Persisted as-is in `pages.block_styles[blockId]` (jsonb) and in
 * `blockStyleDefaults[blockType]` at the store-settings layer.
 */
export type BlockStyle = {
  eyebrow?: EyebrowStyle
  heading?: TypographyStyle
  subheading?: TypographyStyle
  accent?: AccentStyle
  media?: MediaStyle
  section?: SectionStyle
}

// ---------------------------------------------------------------------------
// varsForStyle
// ---------------------------------------------------------------------------

type ControlGroup = Record<string, VocabControl<string> | MultiVocabControl<string>>

/** A `MultiVocabControl` has `toCssValues`; a plain `VocabControl` doesn't. */
function isMultiControl(
  control: VocabControl<string> | MultiVocabControl<string>,
): control is MultiVocabControl<string> {
  return 'toCssValues' in control
}

/** Walks one group of a `BlockStyle` (e.g. `heading`) against its matching vocab controls, emitting a var per set field. */
function emitGroupVars(
  group: Record<string, string | undefined> | undefined,
  controls: ControlGroup,
  out: Record<string, string>,
) {
  if (!group) return
  for (const [key, value] of Object.entries(group)) {
    if (value == null) continue
    const control = controls[key]
    if (!control) continue
    if (isMultiControl(control)) {
      Object.assign(out, control.toCssValues(value))
    } else {
      out[control.cssVar] = control.toCssValue(value)
    }
  }
}

/**
 * Turns a single block's style overrides into the `--bs-*` CSS vars it sets.
 * Only controls present in `style` produce a var — everything else is
 * omitted so the consuming class's `var(--bs-x, <default>)` falls back to
 * the block's existing default. Pure and deterministic: same input, same
 * output, no reads of block type, DB, or store settings (that's the
 * resolver's job in Task 2).
 */
export function varsForStyle(style: BlockStyle): Record<string, string> {
  const out: Record<string, string> = {}

  emitGroupVars(style.eyebrow, BLOCK_STYLE_VOCAB.eyebrow as unknown as ControlGroup, out)
  emitGroupVars(style.heading, BLOCK_STYLE_VOCAB.heading as unknown as ControlGroup, out)
  emitGroupVars(style.subheading, BLOCK_STYLE_VOCAB.subheading as unknown as ControlGroup, out)
  emitGroupVars(style.accent, BLOCK_STYLE_VOCAB.accent as unknown as ControlGroup, out)
  emitGroupVars(style.media, BLOCK_STYLE_VOCAB.media as unknown as ControlGroup, out)
  emitGroupVars(style.section, BLOCK_STYLE_VOCAB.section as unknown as ControlGroup, out)

  return out
}
