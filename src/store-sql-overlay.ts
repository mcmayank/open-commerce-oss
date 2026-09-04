import { sql } from '@payloadcms/db-postgres'

/** OSS build: one store and no per-store column, so the fragment is empty. */
export const storeSql = (_storeId: string | number) => sql``
