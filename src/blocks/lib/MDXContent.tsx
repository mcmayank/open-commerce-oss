import React from 'react'
import * as runtime from 'react/jsx-runtime'
import Link from 'next/link'

/**
 * Renders MDX compiled by Velite (`s.mdx()` → a component function-body string).
 * The generated code reads the JSX runtime from `arguments[0]`, so we invoke it
 * with `react/jsx-runtime` and pull the default export. Runs on the server — no
 * `"use client"` needed for static content.
 *
 * The MDX analogue of `SharedRichText`: one shared entry point for rendering
 * doc/blog bodies with a consistent component map.
 */

/** Internal links use next/link for client-side nav; external links open safely. */
function Anchor({ href = '', children, ...rest }: React.ComponentProps<'a'>) {
  const isInternal = href.startsWith('/') || href.startsWith('#')
  if (isInternal) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  )
}

const sharedComponents: Record<string, React.ComponentType<Record<string, unknown>>> = {
  a: Anchor as React.ComponentType<Record<string, unknown>>,
}

/** Evaluate Velite's MDX function-body into a component. Not a hook — the name
 *  intentionally avoids the `use` prefix so lint doesn't treat it as one. */
function getMDXComponent(code: string): React.ComponentType<{ components?: Record<string, unknown> }> {
  const fn = new Function(code)
  return fn({ ...runtime }).default
}

interface MDXContentProps {
  code: string
  components?: Record<string, React.ComponentType<Record<string, unknown>>>
  className?: string
}

export function MDXContent({ code, components, className }: MDXContentProps) {
  // Deriving a component from a content string is the whole point here; it is
  // inherently created per-render. Safe for static, server-rendered docs.
  const Component = getMDXComponent(code)
  return (
    <div className={className}>
      {/* eslint-disable-next-line react-hooks/static-components */}
      <Component components={{ ...sharedComponents, ...components }} />
    </div>
  )
}
