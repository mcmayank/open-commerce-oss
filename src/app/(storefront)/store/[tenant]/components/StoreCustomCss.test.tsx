// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import StoreCustomCss from './StoreCustomCss'

afterEach(() => {
  cleanup()
  // Restores any console.error spy created below even if an assertion above it
  // throws first — so a spy from one test can never leak into and mask a
  // genuine error in a sibling test.
  vi.restoreAllMocks()
})

const settings = (over: Record<string, unknown>) => ({ customCssEnabled: true, ...over }) as never

// StoreCustomCss is now an async server component (it reads the request
// nonce via next/headers). React DOM's client renderer — what @testing-
// library/react's `render` drives — can't await an async component the way
// the RSC renderer does, so each test calls it directly as a plain async
// function and passes the already-resolved element into `render`. There is
// no request scope here, so headers() throws inside readNonce() and the
// component falls back to `nonce={undefined}` — exactly the "no x-nonce
// header present" case it must survive without throwing.
describe('StoreCustomCss', () => {
  it('renders the merchant CSS', async () => {
    const { container } = render(await StoreCustomCss({ settings: settings({ customCss: 'a { color: red; }' }) }))
    expect(container.querySelector('style')?.innerHTML).toContain('color: red')
  })

  it('renders nothing when the kill switch is off', async () => {
    const { container } = render(
      await StoreCustomCss({ settings: settings({ customCss: 'a { color: red; }', customCssEnabled: false }) }),
    )
    expect(container.querySelector('style')).toBeNull()
  })

  it('renders nothing when there is no CSS', async () => {
    const { container } = render(await StoreCustomCss({ settings: settings({ customCss: '   ' }) }))
    expect(container.querySelector('style')).toBeNull()
  })

  it('strips @import rather than rendering the imported stylesheet', async () => {
    // sanitizeCustomCss does not throw on this input — @import is a valid
    // at-rule that walkAtRules strips, leaving '' behind. This exercises the
    // `if (css === '') return null` branch, same as the "no CSS" case above,
    // NOT the try/catch. See the next test for the catch path.
    const { container } = render(
      await StoreCustomCss({ settings: settings({ customCss: '@import "https://evil.test/x.css";' }) }),
    )
    expect(container.querySelector('style')).toBeNull()
  })

  it('renders nothing when the stored CSS throws at read time, and logs without the CSS body', async () => {
    // Unclosed block: postcss.parse throws, sanitizeCustomCss rethrows as
    // CustomCssError. This is the only test that reaches the component's
    // try/catch — confirmed by temporarily removing the catch (see task-7
    // report): with it removed, this test fails because the render throws
    // instead of returning null.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // A distinctive marker embedded in the malformed CSS itself. If a future
    // change to the catch's logging started including the raw CSS body (e.g.
    // "for debugging"), this is what would catch it — the body can be up to
    // 32KB and must never end up in logs.
    const secretMarker = 'DO-NOT-LOG-8f3a1c2e-marker'

    const { container } = render(
      await StoreCustomCss({ settings: settings({ customCss: `/* ${secretMarker} */ a { color: red` }) }),
    )
    expect(container.querySelector('style')).toBeNull()

    expect(errorSpy).toHaveBeenCalled()
    const logged = errorSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(logged).not.toContain(secretMarker)
  })

  it('renders nothing when settings are absent', async () => {
    const { container } = render(await StoreCustomCss({ settings: null }))
    expect(container.querySelector('style')).toBeNull()
  })

  it('renders undefined nonce (not a throw) when there is no request scope, i.e. no x-nonce header', async () => {
    const element = await StoreCustomCss({ settings: settings({ customCss: 'a { color: red; }' }) })
    const { container } = render(element)
    expect(container.querySelector('style')?.getAttribute('nonce')).toBeNull()
  })
})
