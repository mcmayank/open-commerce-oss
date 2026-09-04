import { STORE_SLUG } from '@/lib/store-slug'

export interface StoreRequest {
  headers: Headers
  origin?: string
}

/** OSS build: exactly one store, whatever the Host header says. */
export async function resolveStoreSlug(_req: StoreRequest): Promise<string | null> {
  return STORE_SLUG
}
