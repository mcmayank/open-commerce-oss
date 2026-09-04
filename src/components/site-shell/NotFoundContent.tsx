/**
 * Shared 404 body for the (landing-v2) and (platform) route groups. Renders
 * inside each group's root layout, so the site nav/footer frame it and the
 * shell.css classes apply. The storefront's own misses render via
 * app/global-not-found.tsx instead (see the comment there) — this component
 * covers original-request paths that DO match a marketing tree, e.g. an
 * unknown store host at `/` or a mistyped platform URL.
 */
export default function NotFoundContent() {
  return (
    <main
      className="wrap"
      style={{
        minHeight: '55vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        textAlign: 'center',
      }}
    >
      <p className="label">404</p>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
        There&rsquo;s nothing at this address
      </h1>
      <p className="sub" style={{ margin: 0, maxWidth: 400 }}>
        The store or page you&rsquo;re looking for doesn&rsquo;t exist — it may have moved, or the
        link may be mistyped. Check the address, or head back to the home page.
      </p>
      <a className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} href="/">
        Go to the home page
      </a>
    </main>
  )
}
