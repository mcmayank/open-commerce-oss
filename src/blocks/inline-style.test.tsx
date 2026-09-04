// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import { BLOCK_FIXTURES } from './test-fixtures'

/**
 * No block may set colour or font-family through the `style` attribute.
 *
 * Inline declarations beat every external selector short of `!important`, so
 * they would make merchant CSS (docs/THEMING-HOOKS.md) unusable. Both values
 * belong on a class or are already inherited from `body` via StoreTheme.
 *
 * Inline `background`, `border-color` and `border-radius` are deliberately out
 * of scope and still allowed.
 */

afterEach(cleanup)

describe('blocks set no inline colour or font', () => {
  for (const { name, render: renderBlock } of BLOCK_FIXTURES) {
    it(`${name} sets neither color nor font-family inline`, () => {
      const { container } = render(renderBlock())
      const offenders: string[] = []
      container.querySelectorAll<HTMLElement>('*').forEach((el) => {
        const style = (el.getAttribute('style') ?? '').toLowerCase()
        if (/(^|;)\s*color\s*:/.test(style) || style.includes('font-family:')) {
          offenders.push(`<${el.tagName.toLowerCase()}> style="${el.getAttribute('style')}"`)
        }
      })
      expect(offenders).toEqual([])
    })
  }
})
