import { cookies, draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextResponse, type NextRequest } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { resolveStoreSlug } from '@/store-resolver'
import { getStore } from '@/lib/storefront'
import { canPreview, PREVIEW_TENANT_COOKIE, PREVIEW_THEME_COOKIE } from '@/lib/preview'
import { getThemeMeta } from '@/themes/catalog'
import type { TenantsArrayUser } from '@/access/roles'
import { saveStoreTheme } from '@/store-loader-overlay'

/**
 * "Make it live" from the preview banner: persist the previewed template as the
 * tenant's storefrontTheme, then clear the preview. The update runs as the
 * authenticated user with access checks ON, so the same entitlement rule as the
 * admin applies — a premium template on a non-premium plan is rejected.
 */
export async function GET(req: NextRequest) {
  const theme = req.nextUrl.searchParams.get('theme')
  if (!theme || !getThemeMeta(theme)) {
    return new NextResponse('Unknown template', { status: 400 })
  }

  const slug = await resolveStoreSlug({ headers: req.headers, origin: req.nextUrl.origin })
  const store = slug ? await getStore(slug) : null
  if (!store) return new NextResponse('Store not found', { status: 404 })

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!canPreview(user as TenantsArrayUser | null, store.id)) {
    return new NextResponse('Not authorized', { status: 403 })
  }

  try {
    await saveStoreTheme(payload, store.id, theme, user)
  } catch {
    // Entitlement or validation failure — bounce back into preview so the owner
    // sees the template is still not live rather than a raw error page.
    redirect('/?template=locked')
  }

  const dm = await draftMode()
  dm.disable()
  const jar = await cookies()
  jar.delete(PREVIEW_TENANT_COOKIE)
  jar.delete(PREVIEW_THEME_COOKIE)
  redirect('/')
}
