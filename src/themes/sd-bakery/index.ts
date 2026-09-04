import type { StorefrontTheme } from '../types'
import { sdBakeryMeta } from './meta'

/**
 * SD Bakery theme — a token/layout/scheme preset over the shared storefront
 * (Slice E), no longer a bespoke component tree. It declares no view slots, so
 * every route renders the shared components styled by sdBakeryMeta's preset.
 */
export const sdBakeryTheme: StorefrontTheme = { ...sdBakeryMeta }
