import type { SampleCatalogue } from '@/packs/types'

/** OSS build: no bundled demo catalogues. Add your own here. */
export const SAMPLE_CATALOGUES: Record<string, SampleCatalogue> = {}

/** Repo-relative directory that holds `<slug>/images` for each catalogue. */
export const PACKS_DIR = 'src/packs'
