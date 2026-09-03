import { timingSafeEqual } from 'crypto'
import { cookies, draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextResponse, type NextRequest } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { resolveStoreSlug } from '@/store-resolver'
import { getStore } from '@/lib/storefront'
import { isValidSlugFormat } from '@/lib/slug'
import { canPreview, PREVIEW_TENANT_COOKIE, PREVIEW_THEME_COOKIE } from '@/lib/preview'
import { getThemeMeta } from '@/themes/catalog'
import type { TenantsArrayUser } from '@/access/roles'
import { cookieSecure } from '@/lib/cookies'

// Mirrors the timing-safe comparison pattern in src/lib/auth/cron.ts.
function secretMatches(provided: string | null, expected: string | undefined): boolean {
  if (!expected || provided == null || provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  const theme = req.nextUrl.searchParams.get('theme')

  if (!secretMatches(secret, process.env.PREVIEW_SECRET)) {
    return new NextResponse('Invalid preview secret', { status: 401 })
  }
  // A theme param means "try on a template"; a page slug is optional in that
  // case (we land on the home page). When a slug is given it must be well-formed
  // so it can't be abused as an open redirect.
  if (slug && !isValidSlugFormat(slug)) {
    return new NextResponse('Invalid slug', { status: 400 })
  }
  if (theme !== null && !getThemeMeta(theme)) {
    return new NextResponse('Unknown template', { status: 400 })
  }

  // Resolve the tenant from the request host (mirrors src/proxy.ts).
  const storeSlug = await resolveStoreSlug({ headers: req.headers, origin: req.nextUrl.origin })
  const store = storeSlug ? await getStore(storeSlug) : null
  if (!store) return new NextResponse('Store not found', { status: 404 })

  // Require an authenticated, authorized Payload user (session cookie on this host).
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!canPreview(user as TenantsArrayUser | null, store.id)) {
    return new NextResponse('Not authorized to preview this store', { status: 403 })
  }

  const dm = await draftMode()
  dm.enable()
  const jar = await cookies()
  const cookieOpts = {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax' as const,
    path: '/',
  }
  jar.set(PREVIEW_TENANT_COOKIE, String(store.id), cookieOpts)
  if (theme) jar.set(PREVIEW_THEME_COOKIE, theme, cookieOpts)

  redirect(slug ? `/${slug}` : '/')
}
