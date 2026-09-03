// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Footer from './Footer'

afterEach(() => {
  cleanup()
})

const BRAND = /powered by niblr/i

describe('Footer branding gate', () => {
  it('shows the line in the standard layout when the store is not entitled', () => {
    render(<Footer storeName="Acme Supply" showBranding />)
    expect(screen.getByText(BRAND)).toBeTruthy()
    // Guard against a vacuous pass: the footer really rendered.
    expect(screen.getByText('Acme Supply')).toBeTruthy()
  })

  it('hides the line in the standard layout when the store is entitled', () => {
    render(<Footer storeName="Acme Supply" showBranding={false} />)
    expect(screen.queryByText(BRAND)).toBeNull()
    // The rest of the footer must survive — otherwise "absent" proves nothing.
    expect(screen.getByText('Acme Supply')).toBeTruthy()
  })

  it('shows the line in the minimal layout too', () => {
    // The minimal layout rendered no branding at all before this change, so a
    // free store could remove it just by picking a theme. Closing that is the
    // point of gating both layouts.
    render(<Footer storeName="Acme Supply" layout="minimal" showBranding />)
    expect(screen.getByText(BRAND)).toBeTruthy()
    expect(screen.getByText('Acme Supply')).toBeTruthy()
  })

  it('hides the line in the minimal layout when entitled', () => {
    render(<Footer storeName="Acme Supply" layout="minimal" showBranding={false} />)
    expect(screen.queryByText(BRAND)).toBeNull()
    expect(screen.getByText('Acme Supply')).toBeTruthy()
  })

  it('renders the two layouts differently, so the tests above are not testing one path twice', () => {
    const { container: standard } = render(<Footer storeName="Acme Supply" showBranding />)
    const standardHtml = standard.innerHTML
    cleanup()
    const { container: minimal } = render(
      <Footer storeName="Acme Supply" layout="minimal" showBranding />,
    )
    expect(minimal.innerHTML).not.toBe(standardHtml)
  })
})
