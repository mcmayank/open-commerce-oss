/**
 * TEST-ONLY. Derives which `--bs-*` vocabulary groups each storefront block
 * actually consumes, by reading source off disk.
 *
 * Nothing in the application may import this module — it uses `node:fs`, and
 * pulling it into a client bundle would fail the build. Its sole consumer is
 * `panel.test.ts`, which compares the scan against the `parts` declared on
 * STYLABLE_BLOCK_TYPES so a declaration can never silently drift from what the
 * markup really reads.
 *
 * Two things make a plain grep insufficient, and both are handled here:
 *  - Most blocks reference the vars only through the shared Tailwind
 *    class-string consts in `src/blocks/shared/vocab-classes.ts` (FAQ contains
 *    no literal `--bs-heading-` at all), so imports must be resolved.
 *  - Test files mention groups their block does not use, so `*.test.*` is
 *    excluded.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { StyleGroupKey } from './panel'

const VAR_PATTERN = /--bs-([a-z]+)-/g
const GROUPS: readonly StyleGroupKey[] = [
  'eyebrow',
  'heading',
  'subheading',
  'accent',
  'media',
  'section',
]

/** Directories under src/blocks that are not blocks. */
const NON_BLOCK_DIRS = new Set(['shared', 'recipe', 'lib'])

function isGroup(name: string): name is StyleGroupKey {
  return (GROUPS as readonly string[]).includes(name)
}

function groupsIn(source: string): Set<StyleGroupKey> {
  const found = new Set<StyleGroupKey>()
  for (const match of source.matchAll(VAR_PATTERN)) {
    if (isGroup(match[1])) found.add(match[1])
  }
  return found
}

/** exported const name in vocab-classes.ts -> the groups its class string references */
function sharedConstGroups(blocksDir: string): Map<string, Set<StyleGroupKey>> {
  const file = path.join(blocksDir, 'shared', 'vocab-classes.ts')
  const source = fs.readFileSync(file, 'utf8')
  const map = new Map<string, Set<StyleGroupKey>>()
  const declPattern = /export const ([A-Z0-9_]+)\s*=\s*([\s\S]*?)(?=\nexport const |\n\/\*\*|$)/g
  for (const match of source.matchAll(declPattern)) {
    map.set(match[1], groupsIn(match[2]))
  }
  return map
}

export function scanBlockStyleParts(blocksDir: string): Map<string, StyleGroupKey[]> {
  const shared = sharedConstGroups(blocksDir)
  const result = new Map<string, StyleGroupKey[]>()

  const dirs = fs
    .readdirSync(blocksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !NON_BLOCK_DIRS.has(d.name))

  for (const dir of dirs) {
    const found = new Set<StyleGroupKey>()
    const dirPath = path.join(blocksDir, dir.name)

    for (const file of fs.readdirSync(dirPath)) {
      if (!/\.tsx?$/.test(file)) continue
      if (/\.test\./.test(file)) continue

      const source = fs.readFileSync(path.join(dirPath, file), 'utf8')
      groupsIn(source).forEach((g) => found.add(g))

      const importMatch = source.match(
        /import\s*\{([\s\S]*?)\}\s*from\s*['"]@\/blocks\/shared\/vocab-classes['"]/,
      )
      if (!importMatch) continue
      for (const clause of importMatch[1].split(',')) {
        // `HEADING_2XL as HEADING_TYPE` — the imported name is what indexes the map.
        const name = clause.trim().split(/\s+as\s+/)[0].trim()
        shared.get(name)?.forEach((g) => found.add(g))
      }
    }

    result.set(dir.name, [...found].sort())
  }

  return result
}
