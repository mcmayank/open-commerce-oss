import React from 'react'

// Inline stroke icons for the Incentives (trust-badge) block; inherit color via
// currentColor so they pick up --color-accent. Keys match the config select.
// Commerce-focused set: shipping, returns, secure payment, support, warranty, gift.
export const INCENTIVE_ICONS: Record<string, React.FC> = {
  truck: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" strokeLinejoin="round"/><circle cx="7" cy="17" r="1.6"/><circle cx="17.5" cy="17" r="1.6"/></svg>),
  returns: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><path d="M4 8a8 8 0 1 1-1.5 6" strokeLinecap="round"/><path d="M3 4v4h4" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  lock: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinejoin="round"/></svg>),
  support: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><path d="M4 13a8 8 0 0 1 16 0" strokeLinecap="round"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19a4 4 0 0 1-4 3h-2" strokeLinecap="round"/></svg>),
  badge: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6Z" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  gift: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7"><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 13h16M12 9v11" /><path d="M12 9S10 4 7.5 5.5 9 9 12 9Zm0 0s2-5 4.5-3.5S15 9 12 9Z" strokeLinejoin="round"/></svg>),
}

export const INCENTIVE_ICON_OPTIONS = [
  { label: 'Free shipping (truck)', value: 'truck' },
  { label: 'Easy returns', value: 'returns' },
  { label: 'Secure payment (lock)', value: 'lock' },
  { label: 'Support', value: 'support' },
  { label: 'Warranty (badge)', value: 'badge' },
  { label: 'Gift', value: 'gift' },
]
