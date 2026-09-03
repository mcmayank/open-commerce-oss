import React from 'react'
import './globals.css'

export const metadata = {
  description: 'Storefront powered by Niblr.',
  title: 'Storefront',
}

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect for Google Fonts performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Font stylesheets are per-store and emitted by StoreTheme
          (src/app/(storefront)/store/[tenant]/components/StoreTheme.tsx), so a
          store loads only the families it actually uses. These preconnects stay
          here because they are host-level, and warming the connection before
          StoreTheme's <link> is parsed is the entire point of them.
        */}
      </head>
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  )
}
