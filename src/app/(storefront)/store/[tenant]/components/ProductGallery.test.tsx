// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ProductGallery, type GalleryImage } from './ProductGallery'

afterEach(cleanup)

const images: GalleryImage[] = [
  { id: 1, src: '/a.webp', alt: 'first' },
  { id: 2, src: '/b.webp', alt: 'second' },
  { id: 3, src: '/c.webp', alt: 'third' },
]

/** The large, on-page image (not a thumbnail button). */
const mainImg = () => screen.getByTestId('gallery-main').querySelector('img') as HTMLImageElement

describe('ProductGallery thumbnails', () => {
  it('shows the first image as the main image', () => {
    render(<ProductGallery images={images} title="Mug" />)
    expect(mainImg().getAttribute('src')).toBe('/a.webp')
  })

  it('swaps the main image when a thumbnail is clicked', () => {
    render(<ProductGallery images={images} title="Mug" />)
    const before = mainImg().getAttribute('src')
    fireEvent.click(screen.getByRole('button', { name: 'View image 3' }))
    const after = mainImg().getAttribute('src')
    // Presence guard + comparison, so the test cannot pass vacuously.
    expect(after).toBe('/c.webp')
    expect(after).not.toBe(before)
  })

  it('renders no thumbnail strip for a single image', () => {
    render(<ProductGallery images={[images[0]]} title="Mug" />)
    expect(screen.queryByRole('button', { name: /View image/ })).toBeNull()
  })
})

describe('ProductGallery lightbox', () => {
  const openLightbox = () => {
    render(<ProductGallery images={images} title="Mug" />)
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge image' }))
  }

  it('opens a dialog showing the active image', () => {
    openLightbox()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('/a.webp')
  })

  it('navigates with the arrow buttons and wraps', () => {
    openLightbox()
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }))
    // From the first image, previous wraps to the last.
    expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('src')).toBe('/c.webp')
  })

  it('navigates with the keyboard', () => {
    openLightbox()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('src')).toBe('/b.webp')
  })

  it('closes on Escape', () => {
    openLightbox()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows a position counter for multiple images', () => {
    openLightbox()
    expect(screen.getByText('1 / 3')).toBeTruthy()
  })

  it('returns focus to the trigger button when closed with Escape', () => {
    render(<ProductGallery images={images} title="Mug" />)
    const trigger = screen.getByRole('button', { name: 'Enlarge image' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Enlarge image' }))
  })

  it('traps Tab focus within the dialog, wrapping at both ends', () => {
    openLightbox()
    const dialog = screen.getByRole('dialog')
    const closeButton = screen.getByRole('button', { name: 'Close' })
    const nextButton = screen.getByRole('button', { name: 'Next image' })

    nextButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)

    closeButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(nextButton)
  })
})
