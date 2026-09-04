'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/admin/brand/ui'
import { SAMPLE_CATALOGUES } from '@/packs-overlay'
import './seed-button.css'

/**
 * Secondary action on the "Add your first product" step: seed a starter
 * catalogue for a business type the merchant picks.
 *
 * A client island inside the server-rendered NextActionHero — it needs pending
 * state and a POST. The hero itself must stay a server component.
 *
 * Options come from SAMPLE_CATALOGUES so a new business type needs no change
 * here, per the registry-derived rule in CLAUDE.md.
 *
 * The markup uses role="menu" / role="menuitem", so it implements the
 * keyboard and dismissal behaviour those roles promise to assistive tech:
 * Escape and an outside click close the menu and return focus to the
 * trigger; ArrowUp/ArrowDown move focus between items, wrapping at the ends.
 * A menu role with none of that would tell screen reader users to expect
 * interactions that silently do nothing.
 */
/**
 * What a merchant is about to get, counted from the catalogue itself.
 * Never a literal: CLAUDE.md forbids hardcoded counts in UI, and this line
 * has to stay right as packs grow.
 */
function packSize(c: { products: unknown[]; categories: unknown[] }): string {
  const p = c.products.length
  const k = c.categories.length
  return `${p} ${p === 1 ? 'product' : 'products'}, ${k} ${k === 1 ? 'category' : 'categories'}`
}

export function SeedSampleProductsButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Held rather than flashed: on refresh this island unmounts (its onboarding
  // step is now done), so a notice shown alongside router.refresh() would
  // disappear before it could be read. The merchant dismisses it instead.
  const [homepageNotice, setHomepageNotice] = useState(false)
  const triggerId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const options = Object.values(SAMPLE_CATALOGUES)

  useEffect(() => {
    if (!open) return

    // Move focus into the menu, as any ARIA menu is expected to on open.
    itemRefs.current[0]?.focus()

    function handleOutsidePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsidePointerDown)
    return () => document.removeEventListener('mousedown', handleOutsidePointerDown)
  }, [open])

  function closeAndFocusTrigger() {
    setOpen(false)
    document.getElementById(triggerId)?.focus()
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const count = options.length
    if (count === 0) return
    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement)

    if (e.key === 'Escape') {
      e.preventDefault()
      closeAndFocusTrigger()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      itemRefs.current[(currentIndex + 1 + count) % count]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      itemRefs.current[(currentIndex - 1 + count) % count]?.focus()
    }
  }

  async function seed(pack: string, label: string) {
    setPending(label)
    setError(null)
    setOpen(false)
    try {
      const res = await fetch('/api/samples/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Could not add the sample products.')
        return
      }
      const body = (await res.json().catch(() => ({}))) as {
        created?: { homepageSkipped?: boolean }
      }
      if (body.created?.homepageSkipped) {
        setHomepageNotice(true)
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setPending(null)
    }
  }

  if (pending) {
    return (
      <Button variant="ghost" size="sm" disabled>
        Adding {pending.toLowerCase()} products…
      </Button>
    )
  }

  if (homepageNotice) {
    return (
      <div className="nb-onboard__seed">
        <p className="nb-onboard__seed-note" role="status">
          Sample products added. Your homepage was left as you had it — we only replace a homepage
          you haven&rsquo;t edited yet.
        </p>
        <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
          Got it
        </Button>
      </div>
    )
  }

  return (
    <div className="nb-onboard__seed" ref={containerRef}>
      <Button
        id={triggerId}
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Start with sample products
      </Button>

      {open && (
        <div className="nb-onboard__seed-menu">
          <ul className="nb-onboard__seed-list" role="menu" onKeyDown={handleMenuKeyDown}>
            {options.map((c, i) => (
              <li key={c.slug}>
                <button
                  type="button"
                  role="menuitem"
                  ref={(el) => {
                    itemRefs.current[i] = el
                  }}
                  onClick={() => seed(c.slug, c.label)}
                >
                  <span className="nb-onboard__seed-label">{c.label}</span>
                  {/* Counts come from the catalogue itself, never a literal. */}
                  <span className="nb-onboard__seed-detail">{packSize(c)}</span>
                </button>
              </li>
            ))}
          </ul>
          {/*
            The spec calls this sentence "not optional", and it has to be here
            rather than only on the removal card: a merchant told about the
            product limit only after seeding has already been misled. The
            homepage sentence is here for the same reason — a pack replaces the
            home page, and that has to be said before the click, not after.
          */}
          <p className="nb-onboard__seed-note">
            Added to your catalogue and counted towards your plan&rsquo;s product limit.
            Remove them all in one click. This also sets your homepage to the pack&rsquo;s layout,
            unless you have already edited it — then yours is kept.
          </p>
        </div>
      )}

      {error && (
        <p className="nb-onboard__seed-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
