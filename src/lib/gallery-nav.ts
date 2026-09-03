/**
 * Wrap-around navigation for the product image gallery. A single image (or
 * none) stays put, so the lightbox arrows are inert rather than throwing.
 */
export function nextIndex(current: number, count: number): number {
  if (count <= 1) return current
  return (current + 1) % count
}

export function prevIndex(current: number, count: number): number {
  if (count <= 1) return current
  return (current - 1 + count) % count
}
