import React from 'react'

// Inline stroke icons; inherit color via currentColor. Keys match the config select.
export const FEATURE_ICONS: Record<string, React.FC> = {
  truck: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" strokeLinejoin="round"/><circle cx="7" cy="17" r="1.6"/><circle cx="17.5" cy="17" r="1.6"/></svg>),
  leaf: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><path d="M5 19c0-8 6-13 14-13 0 8-5 14-14 13Z" strokeLinejoin="round"/><path d="M5 19c4-4 7-6 10-7"/></svg>),
  clock: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2" strokeLinecap="round"/></svg>),
  star: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 21l-5 2.9 1.2-5.6L4 14.6l5.6-.6Z" strokeLinejoin="round"/></svg>),
  shield: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6Z" strokeLinejoin="round"/></svg>),
  heart: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><path d="M12 20S4 14 4 8.5A3.5 3.5 0 0 1 12 6a3.5 3.5 0 0 1 8 2.5C20 14 12 20 12 20Z" strokeLinejoin="round"/></svg>),
}
export const FEATURE_ICON_OPTIONS = Object.keys(FEATURE_ICONS).map((k) => ({ label: k[0].toUpperCase() + k.slice(1), value: k }))
