import React from 'react'

type Card = { title?: string | null; subtitle?: string | null; corner?: string | null }
const POS: Record<string, string> = {
  topLeft: 'top-4 left-4', topRight: 'top-4 right-4',
  bottomLeft: 'bottom-4 left-4', bottomRight: 'bottom-4 right-4',
}
// Cap at two and de-dupe corners so cards never stack on top of each other.
export function FloatingCards({ cards }: { cards: Card[] | null | undefined }) {
  if (!cards?.length) return null
  const seen = new Set<string>()
  const shown = cards.filter((c) => c.title).slice(0, 2).filter((c) => {
    const corner = c.corner ?? 'topRight'
    if (seen.has(corner)) return false
    seen.add(corner)
    return true
  })
  return (
    <>
      {shown.map((c, i) => (
        <div key={i} className={`absolute ${POS[c.corner ?? 'topRight']} rounded-(--radius-card) bg-(--color-surface) px-4 py-3 shadow-lg`}>
          <p className="text-sm font-semibold text-(--section-heading)">{c.title}</p>
          {c.subtitle && <p className="text-xs text-(--section-muted)">{c.subtitle}</p>}
        </div>
      ))}
    </>
  )
}
