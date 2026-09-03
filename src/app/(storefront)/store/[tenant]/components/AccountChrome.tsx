import React from 'react'
import { resolveActiveTheme } from '@/lib/preview-theme'
import { resolveThemeLayout } from '@/themes/layout'
import type { StoreSetting } from '@/payload-types'
import type { Store } from '@/lib/storefront'
import { showsNiblrBranding } from '@/lib/branding'
import Footer from './Footer'
import Header from './Header'
import StoreTheme from './StoreTheme'

interface AccountChromeProps {
  store: Store
  settings: StoreSetting | null
  children: React.ReactNode
}

/**
 * Shared chrome for account pages — the same Header/Footer/StoreTheme every
 * storefront page uses, restyled by the active theme's preset (tokens + layout).
 */
export default async function AccountChrome({ store, settings, children }: AccountChromeProps) {
  const { theme } = await resolveActiveTheme(store)
  const layout = resolveThemeLayout(theme?.layout)
  const storeName = settings?.storeName ?? store.name
  return (
    <div className="flex min-h-screen flex-col">
      <StoreTheme settings={settings} preset={theme?.tokens} />
      <Header storeName={storeName} settings={settings} layout={layout.header} />
      {children}
      <Footer storeName={storeName} layout={layout.footer} showBranding={showsNiblrBranding(store)} />
    </div>
  )
}
