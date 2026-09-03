/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNavCollapse, NAV_COLLAPSE_KEY } from './useNavCollapse'

describe('useNavCollapse', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to expanded (false)', () => {
    const { result } = renderHook(() => useNavCollapse('u1'))
    expect(result.current.collapsed).toBe(false)
  })

  it('toggles and persists per user', () => {
    const { result } = renderHook(() => useNavCollapse('u1'))
    act(() => result.current.toggle())
    expect(result.current.collapsed).toBe(true)
    expect(localStorage.getItem(NAV_COLLAPSE_KEY('u1'))).toBe('1')
  })

  it('restores persisted state on mount', () => {
    localStorage.setItem(NAV_COLLAPSE_KEY('u2'), '1')
    const { result } = renderHook(() => useNavCollapse('u2'))
    expect(result.current.collapsed).toBe(true)
  })
})
