'use client'
import { useCallback, useEffect, useState } from 'react'

export const NAV_COLLAPSE_KEY = (userId: string) => `nb-nav-collapsed:${userId}`

export function useNavCollapse(userId: string): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(NAV_COLLAPSE_KEY(userId)) === '1')
    } catch {
      /* localStorage unavailable — stay expanded */
    }
  }, [userId])

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(NAV_COLLAPSE_KEY(userId), next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [userId])

  return { collapsed, toggle }
}
