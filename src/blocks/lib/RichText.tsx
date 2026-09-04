import React from 'react'
import { RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'
import type { JSXConverter, JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import { safeHref } from '@/lib/safe-href'

interface SharedRichTextProps {
  data: Parameters<typeof LexicalRichText>[0]['data']
  className?: string
}

/**
 * Wraps a link/autolink JSX converter so a rejected href renders the link's
 * text with no anchor, instead of an <a href="javascript:..."> — the same
 * degrade-to-plain-text behavior the rest of this fix uses everywhere else.
 *
 * This only inspects the *href the library already computed*, so it does not
 * special-case internal-document links: `internalDocToHref` output (or its
 * '#' fallback when none is configured, as here) is left exactly as the
 * library produced it. `safeHref` allows root-relative and `#` links, so a
 * legitimate resolved internal href passes through unchanged; only a genuine
 * `javascript:`/`data:`-style scheme gets stripped.
 */
function sanitizeLinkConverter(converter: JSXConverter<any> | undefined): JSXConverter<any> | undefined {
  if (typeof converter !== 'function') return converter
  // Named, not anonymous: this is a JSXConverter the Lexical renderer calls, not
  // a React component, so `react/display-name` is satisfied by giving it a real
  // name rather than by attaching a misleading displayName.
  return function sanitizedLinkConverter(args) {
    const element = converter(args)
    if (!React.isValidElement(element)) return element
    const { href, children } = element.props as { href?: unknown; children?: React.ReactNode }
    if (safeHref(href)) return element
    return <>{children}</>
  }
}

/**
 * `lexicalEditor()` (src/payload.config.ts) ships with no feature overrides,
 * so the default Link feature's JSX converter is `node.fields.url` with no
 * scheme check — a merchant-typed `javascript:` link renders verbatim. Both
 * `link` (the editor's Link toolbar item) and `autolink` (a plain-text URL
 * lexical auto-detects) carry this same free-text `url` field, so both are
 * wrapped.
 */
const richTextConverters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  link: sanitizeLinkConverter(defaultConverters.link),
  autolink: sanitizeLinkConverter(defaultConverters.autolink),
})

/**
 * Thin wrapper around the Payload lexical-to-JSX renderer so the same import
 * can be reused by the RichText block and any other place that renders lexical
 * content (e.g. the product detail page).
 */
export function SharedRichText({ data, className }: SharedRichTextProps) {
  return <LexicalRichText data={data} className={className} converters={richTextConverters} />
}
