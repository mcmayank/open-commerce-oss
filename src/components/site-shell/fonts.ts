/**
 * Marketing-site primary face: F37 Bolton (variable, wght 20–900), self-hosted
 * via next/font/local so both marketing root layouts share one hashed,
 * preloaded asset with metric-adjusted fallbacks — no Google Fonts request.
 * Licensed under the F37 EULA (do not ship to a public repo without checking
 * the webfont licence). Storefront themes and the admin keep their own fonts.
 *
 * `F37Bolton-VF.woff2` is a SUBSET of the foundry file (kept beside it as
 * `F37Bolton-VF.full.woff2`, which nothing imports): the unused `slnt` axis is
 * pinned at 0, the glyph set is cut to Basic Latin, Latin-1, Latin Extended-A,
 * general punctuation, currency, ™, minus and the basic arrows
 * (U+0000-017F, U+2000-206F, U+20A0-20CF, U+2122, U+2212, U+2190-2199), and
 * the OpenType layout is trimmed to kern/liga/calt/locl/ccmp/mark/mkmk.
 * 141 KB → 48 KB. Every character the marketing pages render was checked
 * against that set (Sep 2026); the emoji, ✓ and ₹ on those pages were never
 * in the foundry file and already fall back. The font is preloaded at high
 * priority on every marketing page, so it shares the first-paint budget with
 * the hero image. Regenerate from the full file with fonttools
 * (`varLib.instancer` slnt=0, then `pyftsubset` with those ranges and
 * features) if the site ever needs Greek, Cyrillic or Latin Extended-B.
 */
import localFont from 'next/font/local'

export const bolton = localFont({
  src: '../../fonts/F37Bolton-VF.woff2',
  weight: '20 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-bolton',
})
