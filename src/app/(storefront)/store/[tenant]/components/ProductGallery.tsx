'use client'

import { useEffect, useRef, useState } from 'react'
import { nextIndex, prevIndex } from '@/lib/gallery-nav'

export type GalleryImage = {
  id: string | number
  src: string
  srcSet?: string
  alt: string
  width?: number
  height?: number
}

const MAIN_SIZES = '(min-width: 1024px) 50vw, 100vw'
const THUMB_SIZES = '(min-width: 1024px) 12vw, 25vw'
/** A swipe shorter than this is treated as a tap, not a navigation. */
const SWIPE_THRESHOLD = 40

export function ProductGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const current = images[active] ?? images[0]

  return (
    <div className="space-y-4">
      <button
        type="button"
        data-testid="gallery-main"
        aria-label="Enlarge image"
        onClick={() => setOpen(true)}
        className="block aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl bg-(--color-surface-alt)"
      >
        <img
          src={current.src}
          srcSet={current.srcSet}
          sizes={MAIN_SIZES}
          alt={current.alt || title}
          width={current.width}
          height={current.height}
          className="h-full w-full object-cover"
        />
      </button>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
              className={`aspect-square overflow-hidden rounded-lg bg-(--color-surface-alt) ${
                i === active ? 'ring-2 ring-(--color-text)' : ''
              }`}
            >
              <img src={img.src} srcSet={img.srcSet} sizes={THUMB_SIZES} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <Lightbox
          images={images}
          index={active}
          title={title}
          onIndex={setActive}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function Lightbox({
  images,
  index,
  title,
  onIndex,
  onClose,
}: {
  images: GalleryImage[]
  index: number
  title: string
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const touchStartX = useRef<number | null>(null)

  // Focus the first focusable control on open (so Tab starts inside the
  // dialog, not on the non-interactive dialog div) and lock body scroll —
  // the CartDrawer overlay does the same. On close, restore focus to
  // whatever triggered the lightbox (the "Enlarge image" button).
  useEffect(() => {
    const previouslyFocused = document.activeElement
    previouslyFocusedRef.current = previouslyFocused instanceof HTMLElement ? previouslyFocused : null
    closeButtonRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocusedRef.current?.focus()
    }
  }, [])

  const go = (i: number) => onIndex(i)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowRight') go(nextIndex(index, images.length))
    else if (e.key === 'ArrowLeft') go(prevIndex(index, images.length))
    else if (e.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button')
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta <= -SWIPE_THRESHOLD) go(nextIndex(index, images.length))
    else if (delta >= SWIPE_THRESHOLD) go(prevIndex(index, images.length))
    touchStartX.current = null
  }

  const img = images[index]
  const arrow =
    'absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-(--color-surface-alt) text-2xl text-(--color-text)'

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} images`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0].clientX
      }}
      onTouchEnd={onTouchEnd}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
    >
      <button
        ref={closeButtonRef}
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-(--color-surface-alt) text-2xl leading-none text-(--color-text)"
      >
        &times;
      </button>

      {images.length > 1 && (
        <button
          type="button"
          aria-label="Previous image"
          onClick={(e) => {
            e.stopPropagation()
            go(prevIndex(index, images.length))
          }}
          className={`${arrow} left-4`}
        >
          &#8249;
        </button>
      )}

      <img
        src={img.src}
        srcSet={img.srcSet}
        sizes="100vw"
        alt={img.alt || title}
        width={img.width}
        height={img.height}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] object-contain"
      />

      {images.length > 1 && (
        <button
          type="button"
          aria-label="Next image"
          onClick={(e) => {
            e.stopPropagation()
            go(nextIndex(index, images.length))
          }}
          className={`${arrow} right-4`}
        >
          &#8250;
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-(--color-surface-alt) px-3 py-1 text-sm text-(--color-text)">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  )
}
