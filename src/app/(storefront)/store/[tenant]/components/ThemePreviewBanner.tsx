import React from 'react'

/**
 * Fixed banner shown to a store owner previewing a template they haven't
 * committed to. "Make it live" persists the template (respecting entitlement);
 * "Exit" clears the preview. Normal visitors never see this — it renders only
 * when resolveActiveTheme reports an active, tenant-matched preview session.
 */
export default function ThemePreviewBanner({ slug }: { slug: string }) {
  const label = slug === 'default' ? 'Default' : slug.replace(/-/g, ' ')
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '10px 16px',
        background: '#16151a',
        color: '#f7f6f3',
        fontSize: 13,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <span style={{ textTransform: 'capitalize' }}>
        Previewing the <strong>{label}</strong> template
      </span>
      <span style={{ display: 'flex', gap: 8 }}>
        <a
          href={`/api/preview/commit?theme=${encodeURIComponent(slug)}`}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            background: '#f7f6f3',
            color: '#16151a',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Make it live
        </a>
        <a
          href="/api/preview/exit"
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: '1px solid #4a4a52',
            color: '#f7f6f3',
            textDecoration: 'none',
          }}
        >
          Exit preview
        </a>
      </span>
    </div>
  )
}
