// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import StoreTheme from './StoreTheme'
import type { StoreSetting } from '@/payload-types'

afterEach(() => {
  cleanup()
})

// StoreTheme is an async server component (it reads the request nonce via
// next/headers to nonce its own <style> tag — see src/proxy.ts and
// src/lib/csp.ts). React DOM's client renderer, which @testing-library/
// react's `render` drives, can't await an async component the way the RSC
// renderer does, so each test calls it directly as a plain async function
// and passes the resolved element into `render`. There is no request scope
// in a unit test, so headers() throws and the component must fall back to
// `nonce={undefined}` rather than propagate that throw.
describe('StoreTheme', () => {
  it('renders the theme <style> tag without a request scope, with no nonce attribute', async () => {
    const element = await StoreTheme({ settings: null })
    const { container } = render(element)
    const style = container.querySelector('style')
    expect(style).not.toBeNull()
    expect(style?.getAttribute('nonce')).toBeNull()
  })

  it('emits the CSS variable block', async () => {
    const element = await StoreTheme({ settings: null })
    const { container } = render(element)
    expect(container.querySelector('style')?.innerHTML).toContain(':root')
  })
})

const withFonts = (theme: Record<string, unknown>) =>
  ({ theme } as unknown as StoreSetting)

describe('StoreTheme font loading', () => {
  it('emits a stylesheet link for a Google family', async () => {
    const element = await StoreTheme({
      settings: withFonts({
        fontFamily: 'Inter',
        fontFamilyAxes: { category: 'sans-serif', hasItalic: true, variable: true, min: 100, max: 900 },
      }),
    })
    const { container } = render(element)
    const link = container.querySelector('link[rel="stylesheet"]')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toContain('family=Inter:wght@300..800')
  })

  it('emits no link when the store is on the system font', async () => {
    const element = await StoreTheme({ settings: withFonts({ fontFamily: 'system' }) })
    const { container } = render(element)
    // Presence guard: prove the component rendered at all, so this assertion
    // cannot pass because nothing was rendered.
    expect(container.querySelector('style')).not.toBeNull()
    expect(container.querySelector('link[rel="stylesheet"]')).toBeNull()
  })

  it('emits no link when the store inherits its theme font', async () => {
    const element = await StoreTheme({ settings: withFonts({}) })
    const { container } = render(element)
    expect(container.querySelector('style')).not.toBeNull()
    expect(container.querySelector('link[rel="stylesheet"]')).toBeNull()
  })

  it('requests body and heading families in one link', async () => {
    const element = await StoreTheme({
      settings: withFonts({
        fontFamily: 'Inter',
        fontFamilyAxes: { category: 'sans-serif', hasItalic: true, variable: true, min: 100, max: 900 },
        headingFont: 'Lora',
        headingFontAxes: { category: 'serif', hasItalic: true, variable: true, min: 400, max: 700 },
      }),
    })
    const { container } = render(element)
    const href = container.querySelector('link[rel="stylesheet"]')?.getAttribute('href') ?? ''
    expect(href).toContain('family=Inter')
    expect(href).toContain('family=Lora')
  })

  it('emits a link for a valid variable family, but drops a slot whose axes min is NaN', async () => {
    // Positive control: a normal variable family still gets a link.
    const valid = await StoreTheme({
      settings: withFonts({
        fontFamily: 'Inter',
        fontFamilyAxes: { category: 'sans-serif', hasItalic: true, variable: true, min: 100, max: 900 },
      }),
    })
    const { container: validContainer } = render(valid)
    expect(validContainer.querySelector('link[rel="stylesheet"]')).not.toBeNull()
    cleanup()

    // Negative control: `typeof NaN === 'number'` would pass a plain typeof
    // check, letting weightSpec's clamp() propagate NaN into the URL as
    // `wght@NaN..NaN` — a 400 from Google's css2 endpoint that drops the
    // whole font, not just the malformed weight. The slot must be dropped
    // instead.
    const element = await StoreTheme({
      settings: withFonts({
        fontFamily: 'Inter',
        fontFamilyAxes: { category: 'sans-serif', hasItalic: true, variable: true, min: NaN, max: 900 },
      }),
    })
    const { container } = render(element)
    // Presence guard: prove the component rendered at all, so the "no link"
    // assertion below cannot pass because nothing was rendered.
    expect(container.querySelector('style')).not.toBeNull()
    expect(container.querySelector('link[rel="stylesheet"]')).toBeNull()
  })

  it('quotes the family in the emitted CSS variables', async () => {
    const element = await StoreTheme({
      settings: withFonts({
        fontFamily: 'Cormorant Garamond',
        fontFamilyAxes: { category: 'serif', hasItalic: true, variable: true, min: 300, max: 700 },
      }),
    })
    const { container } = render(element)
    const css = container.querySelector('style')?.textContent ?? ''
    expect(css).toContain('--font-body: "Cormorant Garamond", Georgia, serif;')
  })
})
