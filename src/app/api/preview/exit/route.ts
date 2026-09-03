import { cookies, draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'
import { isValidSlugFormat } from '@/lib/slug'
import { PREVIEW_TENANT_COOKIE, PREVIEW_THEME_COOKIE } from '@/lib/preview'

export async function GET(req: NextRequest) {
  const dm = await draftMode()
  dm.disable()
  const jar = await cookies()
  jar.delete(PREVIEW_TENANT_COOKIE)
  jar.delete(PREVIEW_THEME_COOKIE)
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  redirect(isValidSlugFormat(slug) ? `/${slug}` : '/')
}
