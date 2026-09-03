import React from 'react'
import type { Atom, SlotRef } from './types'
import { RECIPE_ICONS } from './icons'
import { mediaSrcSet, type MediaLike } from '@/lib/image'
import { safeHref } from '@/lib/safe-href'

/**
 * The fields the media atom needs. A Payload Media doc satisfies this.
 *
 * It extends `MediaLike` (src/lib/image.ts) rather than redeclaring `url`,
 * because `mediaSrcSet` reads `sizes` and `width` off the doc as well — and a
 * type that named only `{ id, url, alt }` would make the responsive variants
 * look incidental. They are not: `resolveRecipeMedia` casts its query results
 * to this type, so an honest projection written against a narrower type would
 * drop `sizes`, silently downgrade every custom section to a single full-size
 * image, and break no test that asserts only `src`.
 */
export type RecipeMediaDoc = MediaLike & { id: string | number; alt?: string | null }

/**
 * One renderer per atom kind (Plan: recipe language, Task 2).
 *
 * `level` decides which published `nb-hooks/1` part name an atom emits — the
 * same block/item split the hook contract draws (see `src/blocks/lib/hooks.ts`).
 * `heading`, `text`, and `media` have both a block-level and an `item-`
 * form; `icon` publishes as media (an icon *is* the item's media role, and
 * this is what makes a recipe reproduction of FeatureGrid match its
 * `item-media` hook); `eyebrow`, `badge`, and `link`/`cta` are flat — no
 * `item-` variant exists for them, per the contract's flat-name rule.
 *
 * An atom whose value is empty renders `null`, never an empty element — an
 * empty `<p>` or `<h2>` is a worse signal than nothing at all.
 */

const HEADING_TAGS = { 2: 'h2', 3: 'h3', 4: 'h4' } as const

const HEADING_SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-lg sm:text-xl',
  md: 'text-2xl sm:text-3xl',
  lg: 'text-3xl sm:text-4xl',
}

const TEXT_SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

const ASPECT_CLASSES: Record<'1:1' | '4:5' | '3:2' | '16:9', string> = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '3:2': 'aspect-[3/2]',
  '16:9': 'aspect-video',
}

const FIT_CLASSES: Record<'cover' | 'contain', string> = {
  cover: 'object-cover',
  contain: 'object-contain',
}

const BUTTON_STYLE_CLASSES: Record<'primary' | 'ghost', string> = {
  primary:
    'inline-block rounded-(--radius-button) bg-(--color-primary) px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90',
  ghost:
    'inline-block rounded-(--radius-button) border border-current px-6 py-2.5 text-sm font-semibold text-(--color-accent) transition-opacity hover:opacity-90',
}

/** Block-level parts get their bare name; item-level parts get an `item-` prefix. */
function levelPart(base: 'heading' | 'body' | 'media', level: 'block' | 'item'): string {
  return level === 'item' ? `item-${base}` : base
}

// Rejects both an empty string and a whitespace-only one (e.g. "   "). The
// latter is `.length > 0` but has nothing readable in it — treating it as
// present would render an anchor or heading whose text a visitor cannot see,
// which is a worse signal than rendering nothing at all (see module docblock).
function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export function RecipeAtom({
  atom,
  source,
  index,
  level,
  media,
}: {
  atom: Atom
  /**
   * The slot values for this header or item, keyed by slot name. Atoms read
   * their own slots rather than receiving one pre-resolved value, because an
   * atom may declare more than one (e.g. `link`'s `slot` and `hrefSlot`) — and
   * this keeps every caller (the form, the content cleaner, this renderer)
   * free of per-atom-kind knowledge.
   */
  source: Record<string, unknown> | undefined
  index: number
  level: 'block' | 'item'
  /**
   * Resolved Media documents for every `media`-slot id referenced anywhere in
   * the recipe, keyed by `String(id)` — a stored slot value may be a number
   * or a string depending on how it was written, so the lookup normalizes
   * both to the same key. Task 4 builds this map; this component only
   * consumes it.
   */
  media?: Map<string, RecipeMediaDoc>
}): React.ReactElement | null {
  const slotValue = (ref: SlotRef | undefined): unknown => (ref && source ? source[ref.name] : undefined)

  switch (atom.kind) {
    case 'heading': {
      const text = asText(slotValue(atom.slot))
      if (!text) return null
      const Tag = HEADING_TAGS[atom.level]
      return React.createElement(
        Tag,
        {
          'data-nb-part': levelPart('heading', level),
          className: `font-bold tracking-tight text-(--section-heading) ${HEADING_SIZE_CLASSES[atom.size]}`,
        },
        text,
      )
    }

    case 'text': {
      const text = asText(slotValue(atom.slot))
      if (!text) return null
      return (
        <p data-nb-part={levelPart('body', level)} className={`leading-relaxed ${TEXT_SIZE_CLASSES[atom.size]}`}>
          {text}
        </p>
      )
    }

    case 'eyebrow': {
      const text = asText(slotValue(atom.slot))
      if (!text) return null
      return (
        <p data-nb-part="eyebrow" className="text-sm font-semibold uppercase tracking-wide text-(--color-accent)">
          {text}
        </p>
      )
    }

    case 'badge': {
      if (atom.source === 'index') {
        return (
          <span
            data-nb-part="badge"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--color-primary) text-sm font-semibold text-white"
          >
            {index + 1}
          </span>
        )
      }
      const text = asText(slotValue(atom.slot))
      if (!text) return null
      return (
        <span
          data-nb-part="badge"
          className="inline-flex items-center rounded-full bg-(--color-primary) px-2.5 py-0.5 text-sm font-semibold text-white"
        >
          {text}
        </span>
      )
    }

    case 'link': {
      const label = asText(slotValue(atom.slot))
      if (!label) return null
      // safeHref, not asText: a stored href is untrusted merchant content and
      // must be allowlisted by scheme (src/lib/safe-href.ts), not merely
      // checked for being a non-empty string — the same posture
      // src/lib/custom-css.ts already takes on merchant-supplied URLs.
      const href = safeHref(slotValue(atom.hrefSlot))
      const className = 'underline-offset-2 hover:underline text-(--color-accent)'
      // No destination yet: render the copy, not a dead anchor. A merchant
      // mid-edit sees their text; a crawler is not offered a link to nowhere.
      if (!href) return <span data-nb-part="link" className={className}>{label}</span>
      return <a data-nb-part="link" href={href} className={className}>{label}</a>
    }

    case 'button': {
      const label = asText(slotValue(atom.slot))
      if (!label) return null
      const href = safeHref(slotValue(atom.hrefSlot))
      const className = BUTTON_STYLE_CLASSES[atom.style]
      if (!href) return <span data-nb-part="cta" className={className}>{label}</span>
      return <a data-nb-part="cta" href={href} className={className}>{label}</a>
    }

    case 'media': {
      const raw = slotValue(atom.slot)
      if (raw === null || raw === undefined || raw === '') return null
      const doc = media?.get(String(raw))
      // Unresolvable id: render nothing rather than a broken image. The
      // storefront renders what is saved, and a deleted Media doc must not
      // leave a broken frame on a live page.
      if (!doc?.url) return null
      return (
        <div
          data-nb-part={levelPart('media', level)}
          className={`overflow-hidden rounded-(--radius-lg) ${ASPECT_CLASSES[atom.aspect]}`}
        >
          <img
            src={doc.url}
            srcSet={mediaSrcSet(doc)}
            sizes="(min-width: 640px) 50vw, 100vw"
            alt={doc.alt ?? ''}
            className={`h-full w-full ${FIT_CLASSES[atom.fit]}`}
            loading="lazy"
          />
        </div>
      )
    }

    case 'icon': {
      const key = asText(slotValue(atom.slot))
      if (!key) return null
      // RECIPE_ICONS is the union of FeatureGrid's and Incentives' registries
      // (src/blocks/recipe/icons.tsx) — a recipe section is neither shipped
      // block, so it needs a key space wide enough for both. Fall back to
      // `star`, matching the established per-block pattern of falling back to
      // one's own default rather than rendering nothing.
      const Icon = RECIPE_ICONS[key] ?? RECIPE_ICONS.star
      return (
        <div data-nb-part={levelPart('media', level)} className="shrink-0 text-(--color-accent)">
          <Icon />
        </div>
      )
    }

    default: {
      // Keeping this assignment is what makes adding a ninth atom kind to the
      // `Atom` union a compile error here. But an unknown *value* reaching
      // this branch at runtime (an older deploy rendering a row a newer
      // deploy wrote, e.g. once `price`/`richText`/`video`/`rating` ship in
      // plan 2) must be skipped, never thrown on — matching `if (!Comp)
      // return null` in src/blocks/index.tsx. Returning `atom` itself would
      // hand React a plain object as a child, which React rejects with
      // "Objects are not valid as a React child", failing the whole section
      // instead of just this one atom.
      const _exhaustive: never = atom
      void _exhaustive
      return null
    }
  }
}
