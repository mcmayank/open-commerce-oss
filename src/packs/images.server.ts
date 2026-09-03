// SERVER-ONLY MODULE. Do not import this from a 'use client' component.
//
// The `server-only` package is not a dependency of this repo, so this comment
// is the guard. It matters: this module reads `process.cwd()` and `node:path`,
// and pulling it into the client graph breaks `next build --webpack` with
// `UnhandledSchemeError: Reading from "node:path" is not handled by plugins`.
// Turbopack (`next dev`) polyfills it and hides the failure until build time.
//
// `src/packs/registry.ts` is deliberately free of node builtins so the admin
// picker can import SAMPLE_CATALOGUES from the browser. Keep filesystem code here.
import path from 'node:path'
import fs from 'node:fs'
import type { SampleCatalogue } from './types'
import { PACKS_DIR } from '@/packs-overlay'
// Safe to import here: resolve-refs.ts imports nothing but ./types, so this
// does not pull a node builtin back into the client graph via that module.
import { collectMediaRefs } from './resolve-refs'

/** Absolute path to a pack's images. Callers must validate `slug` first. */
export function packImagesDir(slug: string): string {
  return path.join(process.cwd(), ...PACKS_DIR.split('/'), slug, 'images')
}

/**
 * Total size on disk of a pack's source images, for a pre-seed storage check.
 *
 * Counts the UNION of product images and anything the pack's homepage
 * references — the same set `seedSampleCatalogue` uploads. Summing only the
 * product images under-counts by exactly the homepage-only assets, which is
 * invisible for the bakery pack (its homepage reuses two product images) and
 * lets a near-quota tenant seed past their limit the first time a pack ships a
 * homepage-only file.
 *
 * The union is the ceiling, not always the exact set: a seed that finds the
 * tenant's homepage already edited skips the homepage stage and its images with
 * it. Over-counting there is the safe direction for a pre-flight refusal.
 *
 * This is an estimate, not the final figure. Ingest converts each upload to
 * WebP (usually much smaller) and then generates thumb/card/hero variants,
 * every one of which `totalStoredBytes()` meters — so the generated variants
 * add to this number while the conversion subtracts from it.
 *
 * A missing file counts as 0; `seedSampleCatalogue` reports those with a far
 * more useful message than a quota error would.
 */
export function packSourceBytes(catalogue: SampleCatalogue): number {
  const dir = packImagesDir(catalogue.slug)
  const files = new Set<string>([
    ...catalogue.products.map((p) => p.image),
    ...collectMediaRefs(catalogue.homepage),
  ])
  let total = 0
  for (const file of files) {
    try {
      total += fs.statSync(path.join(dir, file)).size
    } catch {
      /* handled by the seeder */
    }
  }
  return total
}
