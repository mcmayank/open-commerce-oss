import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_GROUPS, PER_STORE_GROUPS } from './nav-groups'

describe('nav group table', () => {
  it('puts orders in Orders, not Store — the defect this redesign fixes', () => {
    expect(NAV_GROUPS.orders).toBe('Orders')
    expect(NAV_GROUPS.orders).not.toBe('Store')
    expect(NAV_GROUPS.invoices).toBe('Orders')
  })

  it('retires the Store junk drawer entirely', () => {
    const groups = Object.values(NAV_GROUPS)
    expect(groups).not.toContain('Store')
    expect(groups).toContain('Catalog')
  })

  it('keeps every per-store group backed by at least one collection', () => {
    const groups = new Set<string>(Object.values(NAV_GROUPS))
    for (const g of PER_STORE_GROUPS) {
      expect(groups, `${g} has no collections`).toContain(g)
    }
  })

  it('does not mark operator-relevant Settings as per-store', () => {
    expect(PER_STORE_GROUPS).not.toContain('Settings')
    expect(PER_STORE_GROUPS).toContain('Catalog')
  })
})

/**
 * Group names are interpolated raw into `#nav-group-${label}` (see
 * tenant-nav-links.css), so a value containing e.g. a space would produce an
 * invalid/unintended CSS id and silently break the platform-operator hiding
 * above. Guard the shape of the value, not just its presence.
 */
describe('NAV_GROUPS values stay valid CSS identifiers', () => {
  const CSS_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]*$/

  it('every group name is a safe CSS identifier', () => {
    for (const value of Object.values(NAV_GROUPS)) {
      expect(value, `"${value}" becomes #nav-group-${value} — must be a valid CSS identifier`).toMatch(
        CSS_IDENTIFIER,
      )
    }
  })

  it('the regex is not vacuous — a deliberately bad sample must fail it', () => {
    expect('Import Jobs').not.toMatch(CSS_IDENTIFIER)
  })
})

/**
 * The platform-operator view hides per-store sections with CSS ids derived from
 * the group NAME. Nothing type-checks that, and it fails on a screen only
 * super-admins see — so parity is asserted here instead.
 */
describe('platform-operator nav hiding', () => {
  const css = readFileSync(
    path.resolve(__dirname, '../components/admin/nav/tenant-nav-links.css'),
    'utf8',
  )

  // Strip /* ... */ blocks before matching. The file documents the pattern in
  // prose (e.g. mentions of a concrete `#nav-group-<Name>`), and without this
  // the regex below would treat a comment's example as a live selector — it
  // only happens to pass today because the doc comment writes the
  // unmatchable `#nav-group-${label}` rather than a concrete id.
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')

  const hiddenIds = [...cssWithoutComments.matchAll(/#nav-group-([A-Za-z0-9_-]+)/g)].map((m) => m[1])

  it('hides exactly the per-store sections — no more, no fewer', () => {
    expect([...new Set(hiddenIds)].sort()).toEqual([...PER_STORE_GROUPS].sort())
  })

  it('hides Orders, closing the leak where Invoices showed on the platform apex', () => {
    expect(hiddenIds).toContain('Orders')
  })

  it('no longer references the retired Store group', () => {
    expect(hiddenIds).not.toContain('Store')
    expect(hiddenIds).toContain('Catalog')
  })

  it('never hides Settings — Domains and Team are operator-relevant', () => {
    expect(hiddenIds).not.toContain('Settings')
  })
})

/**
 * Each collection's nav group must be expressed via NAV_GROUPS, not a hardcoded
 * string literal — otherwise editing a collection back to `group: 'Store'` would
 * silently drift from nav-groups.ts (the source the CSS parity test above trusts)
 * with nothing to catch it. Collection modules import `@payload-config`
 * transitively, which needs a live DATABASE_URL, so they are read as TEXT here
 * rather than imported.
 */
describe('collection group assignment stays out of hardcoded literals', () => {
  const collectionsDir = path.resolve(__dirname, '.')

  /**
   * Every slug in NAV_GROUPS maps to a PascalCase collection file
   * (`discount-codes` -> `DiscountCodes.ts`). Deriving the file list from
   * NAV_GROUPS — rather than hand-maintaining an array — is what makes this
   * guard cover every collection automatically: a future addition to
   * NAV_GROUPS is checked here for free, and one that is missed can't
   * silently stay uncovered the way a hand-maintained list could.
   */
  function slugToFilename(slug: string): string {
    return (
      slug
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('') + '.ts'
    )
  }

  // Tenants/Domains/VoiceConfigs live in src/hosted/collections since step 6
  // of the OSS export plan; the guard covers both directories.
  const hostedCollectionsDir = path.resolve(__dirname, '../hosted/collections')
  const dirOf = new Map<string, string>()
  for (const dir of [collectionsDir, hostedCollectionsDir]) {
    if (!existsSync(dir)) continue // absent in the OSS export
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.ts') && !name.includes('.test.')) dirOf.set(name, dir)
    }
  }
  const filesOnDisk = new Set(dirOf.keys())

  const files = Object.keys(NAV_GROUPS).flatMap((slug) => {
    const file = slugToFilename(slug)
    // In the OSS export the hosted collections directory is absent, and a
    // NAV_GROUPS slug that lives there (domains) has nothing to check.
    if (!existsSync(hostedCollectionsDir) && !filesOnDisk.has(file)) return []
    // Fail loudly rather than skip: an unresolved slug must not silently
    // drop out of coverage.
    expect(
      filesOnDisk.has(file),
      `NAV_GROUPS slug "${slug}" maps to "${file}", which does not exist in ` +
        'src/collections/ — fix slugToFilename() or the slug so this guard ' +
        'keeps covering every NAV_GROUPS entry.',
    ).toBe(true)
    return [file]
  })

  it('resolves a file for every NAV_GROUPS slug — comparative: the derived list is not shorter than the table', () => {
    // In the OSS export, slugs whose collection is hosted-only (domains) are skipped above.
    const hostedOnlySkipped = existsSync(hostedCollectionsDir)
      ? 0
      : Object.keys(NAV_GROUPS).filter((slug) => !filesOnDisk.has(slugToFilename(slug))).length
    expect(files.length).toBe(Object.keys(NAV_GROUPS).length - hostedOnlySkipped)
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`${file} sets group: via NAV_GROUPS, not a string literal`, () => {
      const source = readFileSync(path.join(dirOf.get(file)!, file), 'utf8')
      const groupLines = source
        .split('\n')
        .filter((line) => /\bgroup\s*:/.test(line) && !/type:\s*'group'/.test(line))

      expect(groupLines.length, `${file} should declare a group: nav assignment`).toBeGreaterThan(
        0,
      )

      for (const line of groupLines) {
        expect(line, `${file}: "${line.trim()}" should reference NAV_GROUPS`).toMatch(
          /NAV_GROUPS/,
        )
        expect(line, `${file}: "${line.trim()}" should not be a hardcoded literal`).not.toMatch(
          /group:\s*'[^']*'/,
        )
      }
    })
  }
})

/**
 * Payload renders one nav section per distinct `admin.group`, in the order each
 * group is FIRST seen while walking the registered `collections` array in
 * payload.config.ts. That ordering is implicit and easy to disturb by adding a
 * collection in the wrong place, so it is asserted here.
 *
 * payload.config.ts is read as TEXT rather than imported: importing it (or any
 * collection module, e.g. Orders.ts) transitively pulls in `@payload-config`,
 * which requires a live DATABASE_URL and is not available in this test run.
 */
describe('nav section order', () => {
  const configPath = path.resolve(__dirname, '../payload.config.ts')
  const configSource = readFileSync(configPath, 'utf8')

  function extractCollectionIdentifiers(source: string): string[] {
    const match = source.match(/collections:\s*\[([\s\S]*?)\n\s*\],/)
    if (!match) {
      throw new Error(
        'Could not find the `collections: [ ... ]` array in payload.config.ts — ' +
          'the extraction regex is out of date with the file and must be fixed, ' +
          'not skipped.',
      )
    }
    const withoutComments = match[1].replace(/\/\/.*$/gm, '')
    return [...withoutComments.matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1])
  }

  // Collection identifiers (PascalCase, e.g. `DiscountCodes`) map to slugs
  // (kebab-case, e.g. `discount-codes`) which are the keys of NAV_GROUPS.
  function toSlug(identifier: string): string {
    return identifier.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  }

  const identifiers = extractCollectionIdentifiers(configSource)

  it('finds a non-empty collections array to derive order from', () => {
    expect(identifiers.length).toBeGreaterThan(0)
  })

  it('derives sections in merchant-frequency order from the registration order', () => {
    const sections: string[] = []
    for (const id of identifiers) {
      const group = (NAV_GROUPS as Record<string, string>)[toSlug(id)]
      if (group && !sections.includes(group)) sections.push(group)
    }
    expect(sections).toEqual(['Orders', 'Catalog', 'Customers', 'Marketing', 'Storefront', 'Settings'])
    // Comparative pair: Orders must lead; the old order opened with Catalog
    // (via Products, the first merchant-facing collection registered).
    expect(sections[0]).toBe('Orders')
    expect(sections).not.toContain('Store')
  })

  it('keeps every hidden/platform collection registered, just not contributing a section', () => {
    const hiddenIdentifiers = [
      'ImportItems',
      'GatewayConfigs',
      'PaymentAttempts',
      'ProcessedWebhookEvents',
      'PaymentGatewayRequests',
    ]
    // Tenants, Domains and VoiceConfigs are hosted-only: src/hosted/config.ts
    // re-inserts them at their old nav positions (withHosted), so the OSS
    // export can delete that file and still build.
    const hostedConfig = path.resolve(__dirname, '../hosted/config.ts')
    // Absent in the OSS export, where none of the three collections exist either.
    const hostedSource = existsSync(hostedConfig) ? readFileSync(hostedConfig, 'utf8') : null
    for (const id of ['Tenants', 'Domains', 'VoiceConfigs']) {
      expect(identifiers, `${id} is hosted-only and must NOT be in core collections: [ ... ]`).not.toContain(id)
      if (hostedSource !== null) expect(hostedSource, `${id} must be inserted by withHosted()`).toMatch(new RegExp(`insert(Before|After)\\(collections, '[a-z-]+', ${id}\\)`))
    }
    expect(
      (NAV_GROUPS as Record<string, string>)[toSlug('Tenants')],
      'Tenants should not have a NAV_GROUPS entry (it is hidden from nav)',
    ).toBeUndefined()
    for (const id of hiddenIdentifiers) {
      expect(identifiers, `${id} must still be registered in collections: [ ... ]`).toContain(id)
      expect(
        (NAV_GROUPS as Record<string, string>)[toSlug(id)],
        `${id} should not have a NAV_GROUPS entry (it is hidden from nav)`,
      ).toBeUndefined()
    }
  })
})
