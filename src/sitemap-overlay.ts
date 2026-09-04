import type { MetadataRoute } from 'next'

/** OSS build: there is no platform apex, only the store. */
export function platformSitemap(): MetadataRoute.Sitemap {
  return []
}
