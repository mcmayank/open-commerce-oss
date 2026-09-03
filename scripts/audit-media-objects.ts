// scripts/audit-media-objects.ts
/**
 * Reconcile the BUCKET against the DATABASE — the gap `recompute:usage` cannot fill.
 *
 * `recomputeTenantMediaBytes` sums the rows, so it proves the counter matches the
 * database. It cannot see an object sitting in R2 that no row references, or a row
 * pointing at an object that is not there. Both happen: a failed upload, an
 * interrupted migration, a hand-edited row.
 *
 *   pnpm audit:media                                          # report only
 *   CONFIRM_MEDIA_AUDIT=niblrstore pnpm audit:media --delete-orphans
 *   CONFIRM_MEDIA_AUDIT=niblrstore pnpm audit:media --delete-missing-rows
 *
 * Deletes NOTHING without an explicit flag, and refuses even then unless the
 * bucket name is typed literally and the database and bucket agree about which
 * environment they are in.
 *
 * The two flags fix opposite problems. `--delete-orphans` removes bucket objects
 * nothing references. `--delete-missing-rows` removes media docs whose file is
 * gone — a row that can only ever render a broken image. Deleting through Payload
 * rather than SQL so the quota hooks fire and relations are cleaned up.
 *
 * "Orphan" means: present in the bucket, referenced by no `media` row (main file
 * or any generated size) and no `invoices` row. Deleting one is irreversible, so
 * every key is printed with its size before anything happens.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { migrationEnvironmentError } from '../src/lib/migration-guard'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const deleteOrphans = argv.includes('--delete-orphans')
const deleteMissingRows = argv.includes('--delete-missing-rows')
const destructive = deleteOrphans || deleteMissingRows
const bucket = process.env.S3_BUCKET ?? ''

console.log(`bucket : ${bucket}`)
console.log(
  `mode   : ${
    [deleteOrphans && 'DELETE ORPHANS', deleteMissingRows && 'DELETE MISSING ROWS']
      .filter(Boolean)
      .join(' + ') || 'report only'
  }`,
)

if (!bucket) {
  console.error('\nNo S3_BUCKET configured — nothing to audit.')
  process.exit(1)
}

if (destructive) {
  if (process.env.CONFIRM_MEDIA_AUDIT !== bucket) {
    console.error(
      `\nRefusing to delete. Set CONFIRM_MEDIA_AUDIT="${bucket}" to confirm you mean this bucket.`,
    )
    process.exit(1)
  }
  const envError = migrationEnvironmentError({
    databaseUrl: process.env.DATABASE_URL ?? '',
    bucket,
  })
  if (envError) {
    console.error(`\n${envError}`)
    process.exit(1)
  }
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
})

// ── Everything the bucket holds ───────────────────────────────────────────
const objects = new Map<string, number>()
let token: string | undefined
do {
  const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }))
  for (const o of res.Contents ?? []) objects.set(o.Key!, o.Size ?? 0)
  token = res.NextContinuationToken
} while (token)

// ── Everything the database expects ───────────────────────────────────────
const payload = await getPayload({ config })
const referenced = new Set<string>()
/** main filename -> media id, so a MISSING key maps back to a deletable row. */
const mediaByMainFile = new Map<string, number | string>()

for (let page = 1; ; page++) {
  const res = await payload.find({
    collection: 'media',
    limit: 500,
    page,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of res.docs) {
    if (doc.filename) {
      referenced.add(String(doc.filename))
      mediaByMainFile.set(String(doc.filename), doc.id)
    }
    const sizes = (doc as unknown as { sizes?: Record<string, { filename?: string | null }> }).sizes
    for (const size of Object.values(sizes ?? {})) if (size?.filename) referenced.add(size.filename)
  }
  if (!res.hasNextPage) break
}

for (let page = 1; ; page++) {
  const res = await payload.find({
    collection: 'invoices',
    limit: 500,
    page,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of res.docs) {
    const prefix = (doc as unknown as { prefix?: string }).prefix
    if (doc.filename) referenced.add(prefix ? `${prefix}/${doc.filename}` : String(doc.filename))
  }
  if (!res.hasNextPage) break
}

// `invoices` keys are stored with a collection prefix the doc does not carry.
const normalised = new Set<string>()
for (const key of referenced) {
  normalised.add(key)
  normalised.add(`invoices/${key}`)
}

const orphans = [...objects.entries()].filter(([key]) => !normalised.has(key))
const missing = [...normalised].filter(
  (key) => !objects.has(key) && !key.startsWith('invoices/') && !key.includes('/'),
)

const orphanBytes = orphans.reduce((n, [, size]) => n + size, 0)

console.log(`\nbucket objects        ${objects.size}`)
console.log(`referenced by the DB  ${referenced.size}`)
console.log(`\nORPHANS — in the bucket, referenced by nothing (${orphans.length}, ${(orphanBytes / 1024 / 1024).toFixed(1)} MB):`)
for (const [key, size] of orphans.sort((a, b) => b[1] - a[1])) {
  console.log(`  ${(size / 1024).toFixed(0).padStart(7)} KB  ${key}`)
}
console.log(`\nMISSING — referenced by a row, absent from the bucket (${missing.length}):`)
for (const key of missing.sort()) console.log(`             ${key}`)

if (!destructive) {
  console.log(
    '\nReport only — nothing deleted. Re-run with --delete-orphans and/or --delete-missing-rows.',
  )
  process.exit(0)
}

if (deleteMissingRows) {
  // A row whose file is gone can only ever render a broken image. Delete through
  // Payload, not SQL, so the storage-quota hooks fire and relations are cleaned.
  const ids = missing.map((key) => mediaByMainFile.get(key)).filter((id) => id !== undefined)
  console.log(`\nDeleting ${ids.length} media row(s) whose file is missing:`)
  for (const id of ids) {
    const doc = await payload.delete({ collection: 'media', id: id!, overrideAccess: true })
    console.log(`  deleted row ${id} (${(doc as { filename?: string }).filename})`)
  }
  if (ids.length !== missing.length) {
    console.log(
      `  NOTE: ${missing.length - ids.length} missing key(s) are generated SIZES, not main ` +
        `files — those belong to a row that still has its main file and are not deleted here.`,
    )
  }
}

if (deleteOrphans) {
  // S3 DeleteObjects takes at most 1000 keys per call.
  for (let i = 0; i < orphans.length; i += 1000) {
    const chunk = orphans.slice(i, i + 1000)
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk.map(([Key]) => ({ Key })) },
      }),
    )
    for (const [key] of chunk) console.log(`  deleted ${key}`)
  }
  console.log(
    `\nDeleted ${orphans.length} orphan(s), reclaiming ${(orphanBytes / 1024 / 1024).toFixed(1)} MB.`,
  )
  if (missing.length && !deleteMissingRows) {
    console.log(
      'MISSING entries are NOT fixed by this — pass --delete-missing-rows to remove those rows.',
    )
  }
}

process.exit(0)
