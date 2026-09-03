/**
 * Regenerates src/lib/fonts/snapshot.json from the live Google Fonts catalog.
 *
 *   GOOGLE_FONTS_API_KEY=... CONFIRM_FULL_CATALOG_REPLACE=yes \
 *     pnpm exec tsx src/lib/fonts/snapshot.script.ts
 *
 * Deliberately manual rather than a build step or a cron: the snapshot is what
 * validation falls back to, so an upstream change must not be able to alter
 * which family names this platform accepts without a human reviewing the diff.
 *
 * IMPORTANT — this is NOT an incremental refresh. It replaces the entire
 * committed file with whatever the live catalog returns today. As of 9 Aug
 * 2026 that is 1,951 families and ~285 KB of JSON.
 *
 * The committed snapshot is the OFFLINE FALLBACK and, through it, the input
 * to the exact-match allowlist in validate.ts. So this script decides which
 * family names the platform will accept when GOOGLE_FONTS_API_KEY is unset
 * or the live call fails. Two consequences worth holding in mind:
 *
 * - Regenerating can REMOVE families. A merchant already using a family that
 *   Google has since retired keeps rendering it (their axes are snapshotted
 *   on the store, and resolveThemeFonts only re-validates a slot whose value
 *   changed) — but that family disappears from the picker.
 * - Review the diff. An upstream change must not be able to alter the
 *   accept-list without a human looking at it, which is why this is manual
 *   rather than a build step or a cron.
 *
 * CONFIRM_FULL_CATALOG_REPLACE=yes is required so a wholesale replacement
 * cannot happen by pasting the one-line command out of .env.example.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchCatalog, __resetCatalogCacheForTests } from './catalog'

async function main(): Promise<void> {
  if (!process.env.GOOGLE_FONTS_API_KEY) {
    console.error('GOOGLE_FONTS_API_KEY is required to regenerate the snapshot.')
    process.exit(1)
  }
  if (process.env.CONFIRM_FULL_CATALOG_REPLACE !== 'yes') {
    console.error(
      'Refusing to run: this replaces the committed snapshot.json wholesale with the live ' +
        'Google Fonts catalog, not an incremental update — families Google has retired are ' +
        'removed from the accept-list. Review the diff afterwards. ' +
        'Set CONFIRM_FULL_CATALOG_REPLACE=yes if that is really what you want.',
    )
    process.exit(1)
  }
  __resetCatalogCacheForTests()
  const families = await fetchCatalog()
  // Sanity floor: the live catalog is normally well over a thousand families
  // (1,951 on 9 Aug 2026), so a result this small means the fetch itself failed
  // partway — bad key, wrong endpoint, truncated response — rather than the
  // catalog actually shrinking. A successful fetch clears this easily, so it is
  // a broken-fetch detector and nothing more; it does not vet the contents.
  if (families.length < 500) {
    console.error(
      `Refusing to write a suspiciously small catalog (${families.length} families) — ` +
        'the live fetch likely failed partway rather than the catalog actually shrinking.',
    )
    process.exit(1)
  }
  const out = join(process.cwd(), 'src/lib/fonts/snapshot.json')
  writeFileSync(out, `${JSON.stringify(families, null, 0)}\n`)
  console.log(
    `Wrote ${families.length} families to ${out}. Review the diff before committing — ` +
      'this file is the offline accept-list, so removals narrow what merchants can pick.',
  )
}

void main()
