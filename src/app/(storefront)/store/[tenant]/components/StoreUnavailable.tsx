/**
 * Holding page shown when a tenant exists but is suspended. Kept intentionally
 * plain and brand-neutral: a suspended store's own theme/settings should not be
 * rendered, and the message must read as temporary (suspension is reversible),
 * not as a hard 404. The store owner still reaches their admin separately to
 * export data and appeal — see the Enforcement & termination terms.
 */
export function StoreUnavailable() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#fafafa',
        color: '#1a1a1a',
      }}
    >
      <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
          This store is temporarily unavailable
        </h1>
        <p style={{ marginTop: '0.75rem', lineHeight: 1.6, color: '#555' }}>
          It isn&rsquo;t open right now. If you&rsquo;re the owner, sign in to your admin for
          details, or get in touch with support.
        </p>
      </div>
    </main>
  )
}
