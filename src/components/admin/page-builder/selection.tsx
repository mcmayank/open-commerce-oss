'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * Selection state for the Phase 3b page-builder shell. Tracks which block
 * (by its `data-nb-block-id`, matching the block's own `id` in the page's
 * `layout` array) is currently selected in the live preview iframe, so the
 * builder chrome (inspector panes, the temporary "Nudge selected" control)
 * can act on it.
 *
 * Deliberately minimal for Task 4 — Milestone B's inspector will read/write
 * this same context to drive real style patches.
 */
type SelectionContextValue = {
  selectedId: string | null
  select: (id: string | null) => void
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
  }, [])

  const value = useMemo(() => ({ selectedId, select }), [selectedId, select])

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext)
  if (!ctx) {
    throw new Error('useSelection must be used within a SelectionProvider')
  }
  return ctx
}
