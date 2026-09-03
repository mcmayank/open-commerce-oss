import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'
import hostedManifest from './oss/manifest.json' with { type: 'json' }

const eslintConfig = [
  // The OSS export output is a build artefact, never linted here.
  { ignores: ['dist-oss/**', 'dist-oss-test-*/**', 'src/migrations-core/**'] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Pre-existing patterns written under the old eslintrc-compat setup;
      // downgraded while migrating to the native flat config (tracked cleanup).
      'react-hooks/set-state-in-effect': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    // `no-html-link-for-pages` is a PAGES-ROUTER rule and this project has no
    // `pages/` directory. Every one of the twelve sites it flagged was checked
    // individually and every one is a deliberate full navigation:
    //   - checkout/success: the reload is load-bearing. CartProvider holds its
    //     summary in useState with no refetch, so after the cart cookie is
    //     cleared only a fresh document resyncs the badge. A <Link> there shows
    //     the just-purchased items still in the cart. Guarded by
    //     src/app/(storefront)/checkout-success-reload.test.ts.
    //   - ThemePreviewBanner: targets /api/preview/commit and /api/preview/exit,
    //     which are API routes. <Link> to an API route is simply wrong.
    //   - global-not-found: renders its own <html>/<body> outside every root
    //     layout, so there is no router context for <Link>.
    //   - the admin notices: /admin/... inside Payload's own shell, which owns
    //     its routing.
    // Left on, the rule trains people to "fix" links that must not be fixed.
    rules: { '@next/next/no-html-link-for-pages': 'off' },
  },
  {
    // Storefront, blocks and admin build their own responsive images:
    // `mediaSrcSet` (src/lib/image.ts) emits a srcSet from the WebP variants
    // Payload generates at ingest (docs/MEDIA-PIPELINE.md). next/image ignores
    // that srcSet and re-optimises already-optimised bytes through
    // /_next/image, so converting would discard the pipeline and pay twice.
    // The admin ones render inside Payload's own admin.
    // NOT disabled for (landing-v2), which correctly uses next/image on static
    // marketing art and is where this rule still earns its keep.
    files: [
      'src/app/(storefront)/**',
      'src/blocks/**',
      'src/components/admin/**',
      'src/lib/invoicing/**',
    ],
    rules: { '@next/next/no-img-element': 'off' },
  },
  {
    // Test fixtures are deliberately partial: `{ doc: { tenant: 7 } } as any`
    // stands in for a Payload hook argument with ~20 required fields, of which
    // the code under test reads one. Spelling those out in full would be noise
    // that rots, and `as unknown as T` only launders the same cast through a
    // type the fixture does not actually satisfy. Unsound types in a test do
    // not ship — the test failing is the safety. 165 warnings, no signal.
    // Production code keeps the rule; the 20 warnings it had are fixed.
    files: ['**/*.test.ts', '**/*.test.tsx', 'tests/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // Payload's migration generator emits `{ db, payload, req }` on every up/down
    // signature; almost every migration only uses `db`. That is 288 warnings — the
    // large majority in the repo — for generated argument lists we do not choose
    // and that regenerate identically with each new migration. Only this rule is
    // relaxed, so a hand-patched migration is still linted for everything else.
    files: ['src/migrations/**'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
  {
    ignores: [
      '.next/',
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
      // Third-party, minified, self-hosted for the voice pipeline's CSP (see
      // src/voice/). Not our source: linting it produced 242 warnings — a third
      // of the repo's total — about a bundle we neither wrote nor can edit.
      'public/vendor/',
    ],
  },
  {
    // Core must never import hosted code. The authoritative check is
    // src/lib/boundary.test.ts (resolves every import against oss/manifest.json);
    // this rule only catches the obvious '@/hosted/…' form early, in the editor.
    // See docs/superpowers/specs/2026-09-02-oss-single-tenant-export-design.md.
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    ignores: [
      // minimatch reads `[tenant]` as a character class; picomatch (boundary.ts) does not.
      ...hostedManifest.hosted.map((g) => g.replace(/[[\]]/g, (c) => `\\${c}`)),
      // Tests of core may import hosted fixtures; the exported tree's own
      // build and test run is the check for those (src/lib/boundary.ts).
      '**/*.test.{ts,tsx}',
      'tests/**',
      // The overlay seams (src/lib/boundary.ts SEAM_FILES) are the only core
      // files that may import hosted code; the export swaps them for identities.
      'src/config-overlay.ts',
      'src/config-overlay-proxy.ts',
      'src/store-resolver.ts',
      'src/entitlements-overlay.ts',
      'src/store-loader-overlay.ts',
      'src/store-scope-overlay.ts',
      'src/store-origin-overlay.ts',
      'src/admin-links-overlay.ts',
      'src/csp-overlay.ts',
      'src/store-sql-overlay.ts',
      'src/storefront-overlay.tsx',
      'src/sitemap-overlay.ts',
      'src/packs-overlay.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/hosted/*', '**/hosted/*'],
              message: 'Core cannot import hosted code. Add an extension point in core instead.',
            },
          ],
        },
      ],
    },
  },
]

export default eslintConfig
