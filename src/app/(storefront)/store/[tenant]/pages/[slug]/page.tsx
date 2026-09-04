import { permanentRedirect } from 'next/navigation'

interface Props {
  params: Promise<{ tenant: string; slug: string }>
}

/**
 * Back-compat: CMS pages moved from `/pages/<slug>` to `/<slug>`. This 308-redirects
 * any old `/pages/<slug>` link to the new root-level URL on the same host.
 */
export default async function LegacyPageRedirect({ params }: Props) {
  const { slug } = await params
  permanentRedirect(`/${slug}`)
}
