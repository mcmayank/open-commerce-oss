import type { StorefrontTheme } from '../types'
import { editorialMeta } from './meta'

/**
 * Editorial theme — now a token/layout/scheme preset over the shared storefront
 * (Slice E), not a bespoke component tree. It declares no view slots, so every
 * route renders the shared components styled by editorialMeta's preset.
 */
export const editorialTheme: StorefrontTheme = { ...editorialMeta }
