import React from 'react'
import type { ImageGalleryBlock, Media } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { mediaSrcSet } from '@/lib/image'

interface ImageGalleryComponentProps {
  block: ImageGalleryBlock
  ctx: BlockContext
}

const GRID_CLASSES: Record<string, string> = {
  '2': 'grid-cols-2',
  '3': 'grid-cols-2 sm:grid-cols-3',
  '4': 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
}

/**
 * ImageGallery block — server component.
 * Renders a responsive grid of images from the media collection.
 *
 * Block-style (`--bs-*`) consumption is section-padding only — there is no
 * heading/eyebrow/body and no section-level width container (the grid itself
 * is full-bleed within the page gutters); the image tiles are item-media and
 * deliberately NOT wired. See src/blocks/Hero/Component.tsx for the pattern.
 */
export function ImageGalleryComponent({ block }: ImageGalleryComponentProps) {
  const { images, columns } = block
  const colClass = GRID_CLASSES[columns ?? '3'] ?? GRID_CLASSES['3']

  if (!images || images.length === 0) return null

  return (
    <section className="py-[var(--bs-section-pad,2.5rem)] px-4 sm:px-6 lg:px-8">
      <div className={`grid ${colClass} gap-3 sm:gap-4`}>
        {images.map((img, i) => {
          const media = typeof img === 'object' && img !== null ? (img as Media) : null
          if (!media?.url) return null
          return (
            <div key={media.id ?? i} data-nb-part="item" className="overflow-hidden rounded-(--radius-lg) bg-(--color-surface-alt) aspect-square">
              <img
                src={media.url}
                srcSet={mediaSrcSet(media)}
                sizes="(min-width: 640px) 50vw, 100vw"
                alt={media.alt ?? ''}
                data-nb-part="item-media"
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
