import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { packImagesDir, packSourceBytes } from './images.server'
import { SAMPLE_CATALOGUES } from '@/packs-overlay'
import type { SampleCatalogue, SampleProduct } from './types'

// Real files on disk, from a real pack — packSourceBytes stats the filesystem,
// and a fake directory would only test the try/catch that swallows ENOENT.
const dir = packImagesDir('bakery')
// The OSS export ships no catalogues, so the directory may not exist; the
// describe below is skipped in that case.
const [productFile, homepageOnlyFile] = (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
  .filter((f) => f.endsWith('.webp'))
  .sort()

function product(image: string): SampleProduct {
  return {
    slug: 'p',
    title: 'P',
    description: 'd',
    priceMinor: 100,
    stock: 1,
    categorySlug: 'c',
    image,
  }
}

function catalogue(over: Partial<SampleCatalogue>): SampleCatalogue {
  return {
    slug: 'bakery',
    label: 'Bakery',
    authoredCurrency: 'AED',
    categories: [{ slug: 'c', title: 'C', description: 'd' }],
    products: [product(productFile)],
    ...over,
  }
}

describe.skipIf(Object.keys(SAMPLE_CATALOGUES).length === 0)('packSourceBytes', () => {
  it('sums the pack’s product images', () => {
    const expected = fs.statSync(path.join(dir, productFile)).size
    expect(packSourceBytes(catalogue({}))).toBe(expected)
  })

  // The regression this test exists for: the seeder uploads product images AND
  // anything the homepage references. Counting only products under-counts the
  // pre-seed storage check by exactly the homepage-only assets, which lets a
  // near-quota tenant seed past their limit undetected.
  it('counts an image only the homepage references', () => {
    const withoutHomepage = packSourceBytes(catalogue({}))
    const withHomepage = packSourceBytes(
      catalogue({
        homepage: [{ blockType: 'mediaHero', media: { $media: homepageOnlyFile } }],
      }),
    )
    expect(withHomepage).toBeGreaterThan(withoutHomepage)
    expect(withHomepage).toBe(
      withoutHomepage + fs.statSync(path.join(dir, homepageOnlyFile)).size,
    )
  })

  it('counts a file shared by a product and the homepage once', () => {
    const shared = packSourceBytes(
      catalogue({ homepage: [{ blockType: 'mediaHero', media: { $media: productFile } }] }),
    )
    expect(shared).toBe(packSourceBytes(catalogue({})))
  })

  it('ignores a filename that is not on disk', () => {
    expect(packSourceBytes(catalogue({ products: [product('nope.webp')] }))).toBe(0)
  })

  // Guards the real caller: the quota pre-flight in /api/samples/seed passes a
  // registered catalogue, so the union must be non-zero for a shipped pack.
  it('reports a non-zero total for every registered pack', () => {
    for (const c of Object.values(SAMPLE_CATALOGUES)) {
      expect(packSourceBytes(c), `${c.slug} measured 0 bytes`).toBeGreaterThan(0)
    }
  })
})
