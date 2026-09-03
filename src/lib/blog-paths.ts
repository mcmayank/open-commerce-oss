/**
 * The one place a blog tag becomes a URL path.
 *
 * Tags are free text in post frontmatter ("build in public"), so the path
 * segment must be percent-encoded. Before this helper the sitemap, the blog
 * index and the tag page each interpolated the raw tag, which shipped
 * `https://niblr.store/blog/tag/build in public` in the sitemap (an invalid
 * URL Google skips) and a canonical with a literal space on the tag page.
 */
export function tagPath(tag: string): string {
  return `/blog/tag/${encodeURIComponent(tag)}`
}

/**
 * Inverse of `tagPath` for the `[tag]` route: Next hands the segment over
 * percent-encoded (`build%20in%20public`), and matching it against the raw
 * frontmatter tag without decoding 404'd every multi-word tag page.
 */
export function tagFromParam(param: string): string {
  return decodeURIComponent(param)
}
