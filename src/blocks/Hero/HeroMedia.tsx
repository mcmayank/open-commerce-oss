import React from 'react'
import type { Media } from '@/payload-types'
import { mediaSrcSet, mediaDimensions } from '@/lib/image'

export function HeroMedia({ media, poster, className, sizes, alt }: {
  media: Media | null; poster: string | null; className: string; sizes: string; alt: string
}) {
  const url = media?.url ?? null
  if (!url) return null
  if (media?.mimeType?.startsWith('video/')) {
    return (
      <video data-nb-part="media" className={className} autoPlay muted loop playsInline poster={poster ?? undefined}>
        <source src={url} type={media.mimeType ?? undefined} />
      </video>
    )
  }
  return (
    // Storefront images are tenant-uploaded and served from per-tenant S3 hosts;
    // next/image's remote allowlist is not a fit here. See the localPatterns note
    // in docs/MEDIA-PIPELINE.md. The directive must be the LAST comment line
    // before the element — a trailing continuation line detaches it.
    <img data-nb-part="media" src={url} srcSet={mediaSrcSet(media)} sizes={sizes}
      width={mediaDimensions(media)?.width} height={mediaDimensions(media)?.height}
      alt={alt} className={className} loading="eager" fetchPriority="high" />
  )
}
