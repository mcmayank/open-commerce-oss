import React from 'react'

/** Fixed banner shown only during draft preview, with an exit link. */
export default function DraftBanner({ slug }: { slug: string }) {
  return (
    <div
      role="status"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 1rem',
        background: '#1f2937',
        color: '#fff',
        fontSize: '0.85rem',
      }}
    >
      <span>Draft preview — this page isn&apos;t published yet.</span>
      <a href={`/api/preview/exit?slug=${encodeURIComponent(slug)}`} style={{ textDecoration: 'underline' }}>
        Exit preview
      </a>
    </div>
  )
}
