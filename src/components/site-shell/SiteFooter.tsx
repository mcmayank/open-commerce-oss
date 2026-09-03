import Link from 'next/link'
import NiblrMark from './NiblrMark'

const FOOTER_LINKS = [
  { href: '/#stores', label: 'Stores like yours' },
  { href: '/#how', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  // Real pages — the /pricing page link supersedes the old #pricing anchor.
  { href: '/features', label: 'Features', page: true },
  { href: '/templates', label: 'Templates', page: true },
  { href: '/pricing', label: 'Pricing', page: true },
  { href: '/docs', label: 'Docs', page: true },
  { href: '/blog', label: 'Blog', page: true },
  { href: '/about', label: 'About', page: true },
  { href: '/changelog', label: 'Changelog', page: true },
  { href: '/privacy', label: 'Privacy', page: true },
  { href: '/terms', label: 'Terms', page: true },
  // Live reference storefront — not sdbakery.ae, see docs/niblr-brand-principles.md.
  { href: 'https://sdbakery.niblr.store', label: 'SD Bakery', external: true },
] as const

export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer>
      <div className="wrap foot">
        <span className="logo">
          <NiblrMark className="mark" />
          <span className="text">niblr</span>
        </span>
        <div className="links">
          {FOOTER_LINKS.map((link) =>
            'external' in link && link.external ? (
              <a key={link.href} href={link.href} target="_blank" rel="noopener">
                {link.label}
              </a>
            ) : 'page' in link && link.page ? (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ) : (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ),
          )}
        </div>
        <div className="tiny">© {year} Niblr · Commerce you own.</div>
      </div>
    </footer>
  )
}
