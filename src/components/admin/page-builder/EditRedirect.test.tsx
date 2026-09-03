import { describe, it, expect, vi } from 'vitest'
import { shouldRenderStockForm } from './EditRedirect'

// `shouldRenderStockForm` is a pure predicate over URLSearchParams — no DOM, no
// router, no cleanup. The only reason this file mocks anything is that
// importing the module under test pulls the `@payloadcms/ui` client barrel in,
// and that barrel transitively imports a `.css` file which Node's ESM loader
// refuses outside jsdom/Vite CSS handling. The mock exists to make the import
// resolvable, not to stand in for behaviour under test.
vi.mock('@payloadcms/ui', () => ({
  DefaultEditView: () => null,
  useConfig: () => ({ config: { routes: { admin: '/admin' } } }),
  useDocumentInfo: () => ({}),
}))

describe('shouldRenderStockForm', () => {
  it('redirects to the builder by default', () => {
    expect(shouldRenderStockForm(new URLSearchParams(''))).toBe(false)
  })

  it('renders the stock Payload form when the escape param is present', () => {
    expect(shouldRenderStockForm(new URLSearchParams('form=1'))).toBe(true)
  })

  it('ignores an escape param with any other value, so a stray ?form=0 does not strand the merchant', () => {
    expect(shouldRenderStockForm(new URLSearchParams('form=0'))).toBe(false)
    expect(shouldRenderStockForm(new URLSearchParams('form=yes'))).toBe(false)
  })
})
