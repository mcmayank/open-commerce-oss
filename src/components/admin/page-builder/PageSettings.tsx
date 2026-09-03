'use client'

import * as React from 'react'
import { useField } from '@payloadcms/ui'

/**
 * "Page settings" section for the Phase 3b page builder (final-review Finding 1).
 *
 * The builder replaces Payload's entire default Pages edit form with the
 * block-builder shell, which meant `title`, `slug`, and the SEO fields had no
 * input anywhere in the builder: editing an existing page's metadata was
 * impossible, and creating a brand-new page dead-ended, since `title` is
 * `required` on the Pages collection (`src/collections/Pages.ts`) but nothing
 * bound it — Save/Publish always failed validation on a field the admin could
 * never see or fill in.
 *
 * Binds directly to the real document fields via `useField`, the same
 * read/write pattern `BlockInspector` uses for `blockStyles` — an explicit
 * `path` resolves against the page-level form regardless of where this
 * component sits in the tree, so it works as long as it renders inside the
 * builder's own `<Form isDocumentForm>` (see `PageBuilderView.tsx`).
 *
 * TODO(3b-follow-up): meta.image (upload), canonicalUrl, and aeo.* are still
 * only editable by dropping into a plain Payload document view — this
 * component covers title / slug / meta.title / meta.description / noindex
 * only, matching the final-review fix scope.
 */
export function PageSettings() {
  const title = useField<string>({ path: 'title' })
  const slug = useField<string>({ path: 'slug' })
  const metaTitle = useField<string>({ path: 'meta.title' })
  const metaDescription = useField<string>({ path: 'meta.description' })
  const noindex = useField<boolean>({ path: 'noindex' })

  return (
    <div className="nb-pb-settings">
      <div className="nb-pb-settings__field">
        <label className="nb-pb-settings__label" htmlFor="nb-pb-settings-title">
          Title <span className="nb-pb-settings__required">*</span>
        </label>
        <input
          id="nb-pb-settings-title"
          type="text"
          className={`nb-pb-settings__input${title.showError ? ' is-error' : ''}`}
          value={title.value ?? ''}
          onChange={(e) => title.setValue(e.target.value)}
          required
          aria-invalid={title.showError || undefined}
        />
        {title.showError ? <p className="nb-pb-settings__error">{title.errorMessage}</p> : null}
      </div>

      <div className="nb-pb-settings__field">
        <label className="nb-pb-settings__label" htmlFor="nb-pb-settings-slug">
          Slug
        </label>
        <input
          id="nb-pb-settings-slug"
          type="text"
          className={`nb-pb-settings__input${slug.showError ? ' is-error' : ''}`}
          value={slug.value ?? ''}
          onChange={(e) => slug.setValue(e.target.value)}
          aria-invalid={slug.showError || undefined}
        />
        {slug.showError ? <p className="nb-pb-settings__error">{slug.errorMessage}</p> : null}
      </div>

      <div className="nb-pb-settings__field">
        <label className="nb-pb-settings__label" htmlFor="nb-pb-settings-meta-title">
          SEO title
        </label>
        <input
          id="nb-pb-settings-meta-title"
          type="text"
          className={`nb-pb-settings__input${metaTitle.showError ? ' is-error' : ''}`}
          value={metaTitle.value ?? ''}
          onChange={(e) => metaTitle.setValue(e.target.value)}
          aria-invalid={metaTitle.showError || undefined}
        />
        {metaTitle.showError ? <p className="nb-pb-settings__error">{metaTitle.errorMessage}</p> : null}
      </div>

      <div className="nb-pb-settings__field">
        <label className="nb-pb-settings__label" htmlFor="nb-pb-settings-meta-description">
          SEO description
        </label>
        <textarea
          id="nb-pb-settings-meta-description"
          className={`nb-pb-settings__textarea${metaDescription.showError ? ' is-error' : ''}`}
          value={metaDescription.value ?? ''}
          onChange={(e) => metaDescription.setValue(e.target.value)}
          aria-invalid={metaDescription.showError || undefined}
        />
        {metaDescription.showError ? (
          <p className="nb-pb-settings__error">{metaDescription.errorMessage}</p>
        ) : null}
      </div>

      <div className="nb-pb-settings__field nb-pb-settings__field--checkbox">
        <label className="nb-pb-settings__checkbox-label" htmlFor="nb-pb-settings-noindex">
          <input
            id="nb-pb-settings-noindex"
            type="checkbox"
            checked={noindex.value ?? false}
            onChange={(e) => noindex.setValue(e.target.checked)}
            aria-invalid={noindex.showError || undefined}
          />
          Hide from search engines (noindex)
        </label>
        {noindex.showError ? <p className="nb-pb-settings__error">{noindex.errorMessage}</p> : null}
      </div>

      {/* TODO(3b-follow-up): meta.image / canonicalUrl / aeo.* */}
    </div>
  )
}
