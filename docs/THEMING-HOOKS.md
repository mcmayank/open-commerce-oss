# Storefront Theming Hooks (`nb-hooks/1`)

This document is for anyone writing CSS against a Niblr storefront: a designer
skinning a merchant's site, or a merchant themselves. It describes the hook
contract — a stable set of `data-*` attributes that every storefront block
emits — and the selectors you can safely write against them.

**Status: the hooks below are live in production today**, and so is the field
you paste your CSS into. Every block on every storefront page renders these
attributes right now, with no configuration required. Store Settings → **Custom
CSS** is where your stylesheet goes; it is validated on save and injected into
your storefront's content pages. If you are here to skin your store, you can
start now — write your selectors against the vocabulary below, then read
[the custom CSS field](#the-custom-css-field) for what the validator accepts.

The contract has a version string, `nb-hooks/1`, because it is designed to be
versioned. Everything in this document belongs to that version. A future
`nb-hooks/2` would be a breaking change to the vocabulary, not a silent edit of
this one.

**Adding a part name is not a breaking change and does not bump the version.**
`nb-hooks/1` identifies the contract's *guarantees* — that a published name is
semantic and stable, and that the list only grows — not the size of the list
at any given moment. `eyebrow`, `badge`, and `link` were added after the
initial eight names with no version change, because no existing selector a
merchant wrote could have broken: a name that didn't exist before can't have
been targeted before. Only renaming or removing a published name would need
`nb-hooks/2`.

---

## The three attributes

Every block on a storefront page is wrapped in a container that carries these
attributes. (See `src/blocks/index.tsx`, the single place they're emitted, so
there is no drift between block types.)

| Attribute | Where it appears | What its value is |
|---|---|---|
| `data-nb-block` | Block wrapper | The block's type slug — e.g. `featureGrid`, `reviews`, `mediaHero`, `ctaBanner`. One of the entries in `PAGE_BLOCKS` (`src/blocks/registry.ts`). |
| `data-nb-variant` | Block wrapper | The block's layout variant, when it has one — e.g. `cards`, `list`, `masonry` on Reviews. Omitted entirely (not present as an empty attribute) when the block has no variant selected. |
| `data-nb-block-id` | Block wrapper | The block instance's stable id (present when the page's blocks have ids). Used by the admin page builder to map a clicked block back to its layout row. |
| `data-nb-part` | Any element inside a block | A semantic role within the block — see the vocabulary below. Not every element gets one; only the ones a designer would want to target. |

`data-nb-block` and `data-nb-variant` sit on the same wrapper `<div>` around a
block's rendered output; `data-nb-part` sits directly on the elements it marks,
wherever they land inside that block's markup.

---

## The part vocabulary

`src/blocks/lib/hooks.ts` is the source of truth for part names. There are two
groups: block-level parts, which mark a role a block has for itself (its own
heading, body copy, media, calls to action, eyebrow label, badges, and plain
text links), and item-level parts, which mark the same roles inside a repeated
item — a card, a row, a tile — when a block renders a list of them.

| Part | Level | What it marks |
|---|---|---|
| `heading` | Block | The block's own title. |
| `body` | Block | The block's own supporting text — a subheading, description, or paragraph. |
| `media` | Block | The block's own image or video — not one belonging to a repeated item. |
| `cta` | Block | A call-to-action link or button belonging to the block itself. |
| `eyebrow` | Block | The small label rendered above a heading (a kicker/overline). |
| `badge` | Block | A small chip carrying a number or status — e.g. a step's number. |
| `link` | Block | A textual link that is *not* a call to action — see below. |
| `item` | Item | One repeated entry — a review card, a feature tile, a gallery image's container. |
| `item-heading` | Item | The title inside a repeated item. |
| `item-body` | Item | The supporting text inside a repeated item. |
| `item-media` | Item | The image or video inside a repeated item. |

The block/item split matters because a block can have both at once. FeatureGrid
has an overall `heading` for the section and an `item-heading` on every tile
underneath it; those are two different elements and two different selectors.

**`link` vs. `cta`: pick by role, not by tag.** Both mark anchors, but they mean
different things to a designer. `cta` is a call to action — a button-styled
link driving the primary action a block wants (Shop Now, Get Started, View
Product). `link` is a plain textual link that happens to sit inline in a
block's copy — Contact's `tel:`/`wa.me`/`mailto:` links are the example: they
read as text, not buttons, so they carry `link`, and CTABanner/Hero/MediaHero
and the rest keep `cta` for their button-styled actions. Reviews' "on {product
title}" credit line (`src/blocks/Reviews/Component.tsx`) is the same case
inside a repeated item: a small textual link, not a button, so it's `link`
too — combined with `item` for scoping, per the flat-name rule below. If
you're not sure which to reach for, ask whether it should look and feel like a
button (`cta`) or like inline text (`link`).

**`eyebrow`, `badge`, and `link` are deliberately flat — there is no
`item-badge` or `item-link`.** `item` already marks the repeated wrapper, so a
part that shows up *inside* an item is scoped with a descendant selector
rather than a new name. Steps' numbered badge is the worked example: each step
is an `item`, and the numbered circle inside it carries the flat `badge` name,
so you reach it with

```css
[data-nb-part="item"] [data-nb-part="badge"] {
  background: var(--color-accent);
}
```

not `[data-nb-part="item-badge"]` — that name doesn't exist, on purpose. The
same pattern applies if a future block needs an `eyebrow` or `link` inside a
repeated item.

---

## Two promises the contract makes

**A block emits only the parts it has.** ImageGallery has no heading field, so
no block renders a bare `heading` there — it only ever emits `item` and
`item-media`. Spacer, which is nothing but vertical space, emits no parts at
all. Absence of a part is normal, not a bug, and CSS that assumes every block
emits every part in the table above will simply have unmatched selectors on
blocks that don't apply. Never write CSS that depends on a part being present;
write CSS that applies when it is.

**A part name never changes meaning.** `heading` will always be the element you'd
call the block's title, on any block, in any future markup restructuring. The
contract is deliberately semantic, not structural — it promises the role exists,
never that it lives on a particular tag or at a particular nesting depth. That
is what lets block internals be rebuilt (a `<div>` promoted to a `<section>`, a
wrapper added or removed) without it counting as a breaking change to your CSS,
as long as the part attribute moves with the role it marks.

---

## `data-scheme`: the section color band

A separate, already-published hook sits on the same wrapper as `data-nb-block`:
`data-scheme`. It names which token-derived color band a block's section is
rendered on, and is driven by `BLOCK_DEFAULT_SCHEME` in
`src/blocks/lib/colorScheme.ts`. Its four possible values:

| Value | What it resolves to |
|---|---|
| `default` | No band — the section inherits the page background, so consecutive default sections read as one continuous surface. |
| `muted` | A subtle alternate surface color (`--color-surface-alt`), used for sections that should read as a slight step off the page background — testimonials, reviews, incentives, a ticker. |
| `inverse` | A full-color band using the store's primary brand color, with contrast text — used for CTABanner. |
| `accent` | A full-color band using the store's accent color, with contrast text — reserved for blocks that want to stand out more strongly than `inverse`. |

`data-scheme` is useful to combine with `data-nb-block`, because the same part
can sit on different bands depending on which block renders it — a `cta` on a
`default` section usually needs different treatment than a `cta` on an
`inverse` one.

---

## Worked selector examples

These are written against markup that exists in the codebase today, not
hypothetical output.

**Style every feature tile's title, on any FeatureGrid variant:**

```css
[data-nb-block="featureGrid"] [data-nb-part="item-heading"] {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```
Verified against `src/blocks/FeatureGrid/Component.tsx`, where each item's
`<h3>` carries `data-nb-part="item-heading"` regardless of the `iconTop` /
`iconLeft` / `cards` / `minimal` variant.

**Style review cards only in the masonry layout, leaving the default grid and
the list layout untouched:**

```css
[data-nb-block="reviews"][data-nb-variant="masonry"] [data-nb-part="item"] {
  border-radius: 0;
}
```
Verified against `src/blocks/Reviews/Component.tsx`, where the `<figure>`
wrapping each review carries `data-nb-part="item"` in all three variants, and
`data-nb-variant="masonry"` is set on the block wrapper only when that variant
is selected.

**Style the call-to-action button only where CTABanner renders on its inverse
band:**

```css
[data-nb-block="ctaBanner"][data-scheme="inverse"] [data-nb-part="cta"] {
  box-shadow: 0 0 0 2px currentColor;
}
```
Verified against `src/blocks/CTABanner/Component.tsx` (the `<Link>` carries
`data-nb-part="cta"`) and `src/blocks/lib/colorScheme.ts`, where
`BLOCK_DEFAULT_SCHEME.ctaBanner` is `'inverse'`.

**Style Steps' numbered badge, wherever it lands inside a repeated step:**

```css
[data-nb-block="steps"] [data-nb-part="item"] [data-nb-part="badge"] {
  background: var(--color-accent);
}
```
Verified against `src/blocks/Steps/Component.tsx`, where the shared `Badge`
component is marked `data-nb-part="badge"` in one place and used at all four
call sites (`horizontal`, `vertical`, `cards`, `compact`), each of which wraps
it in an element carrying `data-nb-part="item"`. There is no `item-badge`
name — scoping to inside an item is always done by combining `item` and the
flat part name this way, never by inventing an `item-`-prefixed variant.

---

## What is not supported

The contract is these attributes and nothing else. Specifically out of scope,
now and for the foreseeable future:

- **Tailwind utility classes.** Blocks are built with Tailwind internally, and
  those class names appear in the rendered HTML, but they are an implementation
  detail, not part of this contract. They are not documented, not stable, and
  may change on any release — including a patch release — without notice.
- **Element and structural selectors.** Don't write CSS against tag names
  (`h2`, `section`, `img`), nesting depth (`div > div > p`), or sibling order.
  None of that is covered by the survivability promise above; only the
  `data-nb-*` attributes and `data-scheme` are.
- **Our DOM shape in general.** Wrapper elements, extra containers, and class
  names not mentioned on this page can be added, removed, or rearranged at any
  time. If it isn't a `data-nb-*` attribute or `data-scheme` documented above,
  don't build on it.

If a selector you need isn't expressible against this vocabulary, that's a gap
in the vocabulary, not a reason to reach past it into internals.

---

## The custom CSS field

Store Settings → **Custom CSS** is the field, and it has shipped: the field, the
validator, and the injection point all exist. Your CSS is parsed and validated
on save rather than stored untouched, so the constructs below are worth knowing
before you write against the hooks above.

- **`@import` is stripped.** Pulling in an external stylesheet is an unbounded
  surface — arbitrary remote CSS, or worse, is not something a
  merchant-submitted field can pull into every storefront visit.
- **URLs are default-deny.** Only three argument shapes are kept: a `data:` URI
  (inline, self-contained), a root-relative path (starting with a single `/`, so
  it resolves back to your own store's origin), or a same-document `#fragment`
  reference (e.g. `url(#gradient)`, which issues no request at all). Everything
  else is stripped, including absolute URLs (`https://…`), protocol-relative
  ones (`//example.com/…`), and other relative forms (`images/foo.png`,
  `../foo.png`) — those aren't anchored to your own origin, so they're refused
  rather than inspected further. This applies to every function that takes a
  URL, not just `url()`: `image-set()`, `-webkit-image-set()`, `src()` and
  `image()` are held to the same rule. Host your images in your own Media
  library and reference them with a `/`-relative path.
- **CSS escapes outside a quoted string are refused.** A declaration containing
  a backslash anywhere other than inside a string is dropped whole, because an
  escape can disguise any of the rules on this list. `content: "\2014"` is fine
  — that backslash is inside a string. `content: \2014` is not.
- **`position: fixed` is stripped.** A fixed-position element ignores the
  storefront's own layout and can cover navigation, cart controls, or checkout
  UI regardless of where in the page it's declared. `position: sticky` is kept.

There is also a size limit — 32KB — and CSS that fails to parse is rejected
outright rather than silently dropped or partially applied. If your CSS doesn't
save you get a clear parse error, not a store that quietly ignores half your
stylesheet.

A note on over-stripping: these rules read the raw declaration text, so the
*word* `url(` inside a string — `content: "see url(here)"` — is treated as a
URL and the declaration is dropped. That's the default-deny posture failing in
the safe direction, not a bug.

## Where custom CSS applies: content pages, not the checkout flow

Custom CSS is injected on your four content route types — the store home page,
custom pages, the product listing, and product detail pages. The **cart page and
the checkout pages do not receive it at all.** Those carry the flow where a
broken or malicious style could stop a customer completing a purchase, so they
were kept out of scope from the start rather than protected after the fact.

**The cart drawer is not the cart page, and it *is* styleable.** The slide-out
drawer is rendered on every storefront route, so on the four content pages above
it sits inside the styled subtree and your CSS reaches it — including its
Checkout button. This is intentional: styling your own cart drawer is a
reasonable thing to want. What's ring-fenced is the `/cart` and `/checkout`
pages themselves. If you restyle the drawer, check the Checkout button is still
visible and clickable, because nothing stops you hiding it.
