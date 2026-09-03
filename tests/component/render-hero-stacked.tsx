// Deliberately NOT loaded through @playwright/test's own process: Playwright
// ships its own `jsx-runtime.js` (used internally for its reporters), and
// when a spec file transitively imports a real React `.tsx` component,
// Playwright's built-in TS/JSX transform can shadow the project's normal
// `react-jsx` resolution, producing objects `react-dom/server` doesn't
// recognize as real elements ("Objects are not valid as a React child
// (found: object with keys {__pw_type, type, props, key})"). Rendering the
// component out-of-process, via a plain `npx tsx` invocation (the same tool
// this repo already uses for e2e/shots specs, just not through Playwright's
// own loader), sidesteps that conflict entirely — this file is a CLI, not a
// spec, and is spawned by hero-stacked-alignment.component.ts.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeroComponent } from '../../src/blocks/Hero/Component'

const textAlign = process.argv[2] || undefined

const block: Record<string, unknown> = {
  variant: 'stacked',
  heading: 'Own your storefront',
  eyebrow: 'New',
}
if (textAlign) block.textAlign = textAlign

process.stdout.write(
  renderToStaticMarkup(React.createElement(HeroComponent, { block: block as never, ctx: {} as never })),
)
