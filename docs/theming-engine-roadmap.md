# Storefront Theming Engine — Roadmap Spec

_Status: proposed · Date: 2026-07-19_

## Context & goal

Today a "storefront theme" is a **bespoke front-end**: each theme (`sd-bakery`,
`editorial`) reimplements Home/Products/Product as its own React components and
deliberately ignores the shared design tokens. Two themes = two parallel
front-ends; the shared page-builder blocks and commerce components are bypassed.

We are pivoting to the **WordPress block-theme model**: a theme becomes an
**appearance layer**. Content is authored once with a shared set of blocks and
components, and the selected theme decides how those same blocks/components
*look* — their colors, typography, spacing, radius, per-block style variants,
and layout. Switching the theme re-skins the whole site consistently; content
and structure don't change.

**Decisions locked with the user:** a theme controls **tokens + per-block style
variants + layout** · the existing bespoke themes are **converted to presets**
and their bespoke React front-ends retired · the theme must restyle
**everything** (page blocks, commerce views, and chrome).

## The model

A theme stops being components and becomes a **data preset** (a `theme.json`-like
object):

```ts
interface ThemePreset {
  slug: string
  label: string
  entitlement: 'free' | 'premium'
  previewImage?: string
  tokens: ThemeTokens              // colors, fonts, spacing, radius, shadow (Slice A)
  blockDefaults?: BlockStyleDefaults  // per-block colorScheme/variant defaults (Slice C)
  layout?: ThemeLayout             // header/footer/section layout variants (Slice D)
  fields: ThemeFieldDef[]          // which tokens/variants the tenant may customize
}
```

Every storefront surface renders the **shared** components/blocks; the active
theme's tokens (+ the tenant's overrides) are emitted as CSS variables scoped to
the storefront root, and the components consume them. There is no per-theme
component tree.

### What carries over from the work already shipped

This pivot **repurposes** the recently built theming plumbing rather than
discarding it:

| Already built | Role now |
|---|---|
| Selection (registry-driven) + entitlement gating + preview/try-on | Unchanged — still how a theme is picked, gated, previewed |
| `themeCustomizations` JSON + `resolveThemeValues` | Becomes the **token-override store** — a tenant's per-theme color/font/spacing tweaks |
| `ThemeFieldDef` schema + `ThemeCustomizer` form | Becomes the **token/variant editor** — a theme's exposed knobs are color/font/select fields |
| Catalog/registry split (`catalog.ts` pure data) | Unchanged — a theme is still pure metadata, now carrying a **preset** instead of components |
| `resolveActiveTheme` / preview cookies | Unchanged mechanism; what it swaps is the **token set**, not components |
| Editorial / SD Bakery bespoke components | Converted to presets in Slice E, then retired |

### What changes

- `StorefrontTheme` (component slots: `Home`, `Products`, …) is replaced by
  `ThemePreset` (data). The route-level `if (theme?.Home) return <theme.Home>`
  dispatch is removed — every route renders the shared component, tokens do the
  styling (Slice E simplification).
- `buildThemeVars` (6 vars) grows into a full token→CSS-var emitter.
- All hardcoded-gray blocks/components/commerce views are migrated to tokens.

## Current state (assessment, 2026-07-19)

~**50% tokenized** — a fill-in-the-gaps migration, not a from-scratch build.

- **Token engine exists**: `buildThemeVars` (`src/lib/theme.ts`) emits 6 vars
  (`--color-primary/-accent/-surface/-text`, `--font-body`, `--radius-button`),
  injected by `StoreTheme.tsx` as a scoped `:root` `<style>`.
- **Fully token-driven (~8 blocks)**: FeatureGrid, SplitHero, Steps, VideoEmbed,
  LogoStrip, Contact, FeaturedProduct, NewsletterSignup — the pattern to copy.
- **Hardcoded (the work)**: Hero, CTABanner, Testimonials, ProductGrid, FAQ,
  RichText, ImageGallery; chrome (Header, Footer, ProductCard); commerce views
  (PLP, PDP, cart).
- **`--font-heading`** is referenced by newer blocks but never emitted — quick win.
- **`variant` field** exists on ~8 blocks via `VariantPickerField`, but it's
  *layout* only — no color/background/`colorScheme` style variant yet.
- **`RenderBlocks`** has no styling seam: `ctx = { tenantId, currency,
  premiumSections }`, each block owns its `<section>`. A seam must be added for
  Slice C.

## Token schema (Slice A design)

`ThemeTokens` → emitted as CSS variables on the storefront root. Existing 6 var
names are kept as **aliases** so token-native blocks keep working during the
migration.

```
color:  --color-bg, --color-surface, --color-surface-alt,
        --color-text, --color-text-muted, --color-heading,
        --color-primary, --color-primary-contrast, --color-accent, --color-border
font:   --font-body, --font-heading            (heading is the quick-win gap)
radius: --radius-sm, --radius-md, --radius-lg, --radius-button, --radius-card
space:  --space-section, --space-gap, --container-width
shadow: --shadow-card
```

Emitter: `buildThemeCssVars(preset, overrides)` → `Record<string,string>` with
hex/enum validation (extends the current `buildThemeVars` approach). Injection
stays server-rendered and scoped (one tenant per request). A `colorScheme`
concept (`default | surface | inverse | accent`) maps token combos for Slice C.

## Slice-by-slice plan

Each slice leaves the app working and is independently testable. Each gets its
own detailed implementation plan when we build it.

**Slice A — Token engine.** Define `ThemeTokens` + `ThemePreset`; write
`buildThemeCssVars` (full var set, back-compat aliases, validation) with unit
tests; expand `StoreTheme.tsx` injection; add `--font-heading`. Themes gain a
`tokens` preset (Default preset = today's values, so nothing changes visually
yet). _Files:_ `src/lib/theme.ts`, new `src/lib/theme-tokens.ts`,
`StoreTheme.tsx`, `src/themes/*/meta.ts`. _Outcome:_ full token set available;
no visible change.

**Slice B1 — Tokenize chrome + legacy blocks.** Migrate Header, Footer,
ProductCard and the 8 hardcoded blocks from `gray-*` to tokens, copying the
new-gen block pattern. _Outcome:_ selecting a theme (via its token preset)
visibly re-skins pages + chrome.

**Slice B2 — Tokenize commerce views.** PLP, PDP, cart hand-built layouts → token
pass. _Outcome:_ the full storefront re-skins.

**Slice C — Block style variants + `RenderBlocks` seam.** Add a `colorScheme`/
style field to blocks (extend `VariantPickerField`); add a theme-style context/
wrapper in `RenderBlocks` so a theme sets per-block defaults and per-instance
page-builder edits override. _Outcome:_ themes restyle individual block types.

**Slice D — Layout options.** Header (centered vs split masthead) / Footer
(columns vs minimal) / section rhythm + container width become theme-driven
variants. _Outcome:_ themes change structure, not just color.

**Slice E — Convert Editorial/SD Bakery to presets; retire bespoke.** Re-express
each as tokens + block/layout variants (Editorial: cool paper / garnet accent /
Fraunces heading / full-bleed hero / masthead header variant; SD Bakery: cream-
olive / Cormorant+Jost / textured bg). Remove `src/themes/editorial/*` and
`sd-bakery/*` component trees; simplify the route dispatch to always render the
shared components. _Outcome:_ one unified model; bespoke front-ends gone.

## Risks

1. **Fidelity of bespoke conversion (Slice E).** Editorial/SD Bakery have very
   bespoke layouts (masthead hero, cart drawer, textures). The variant/layout
   system (C/D) must be expressive enough, or some flourishes are simplified.
   Sequencing E last, after C/D, de-risks this. Keep bespoke themes working until
   their presets are accepted.
2. **CSS-var scoping / cache-safety.** Injection must stay server-rendered and
   scoped per request (current pattern is safe); don't regress the storefront's
   static cacheability.
3. **Migration churn across many files.** B1/B2 touch many components. Do them
   as a mechanical, reviewable pass using the existing token-native blocks as the
   template; avoid selector-specificity collisions (Tailwind arbitrary vars).
4. **Two theming mechanisms coexist mid-migration.** The component-override
   registry and the token layer both exist until Slice E removes the former. Keep
   the seam clear so behavior stays predictable.

## Verification (per slice)

- **A:** unit tests for `buildThemeCssVars` (defaults, overrides, validation,
  alias back-compat); build stays green; storefront visually unchanged.
- **B1/B2:** run the app; select a theme preset; confirm chrome + blocks +
  commerce re-skin; screenshot before/after; confirm the default preset matches
  today's look.
- **C:** author a page with a block, switch its `colorScheme`, and change theme
  defaults; confirm precedence (instance override > theme default > base).
- **D:** switch layout variants; confirm header/footer/section structure changes.
- **E:** render a store on the Editorial/SD Bakery **preset**; compare against the
  retired bespoke version; confirm parity or accepted simplification; confirm the
  route dispatch no longer branches on component slots.

## Out of scope (for now)

- A visual theme marketplace/gallery UI.
- Arbitrary user-authored themes (themes remain a curated, registered set).
- Per-page (vs per-store) theme selection.
