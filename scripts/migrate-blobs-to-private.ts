/**
 * One-time migration: re-uploads every public blob in the store as private.
 *
 * Blobs uploaded before fix/private-blob-access were created with
 * access: 'public'. This script lists all blobs, detects public ones by
 * attempting an unauthenticated fetch (private blobs return 403), and
 * re-puts each at the same pathname with access: 'private'. Pathnames are
 * deterministic (no random suffix), so blob URLs stored in the database
 * remain valid after migration.
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=... npx tsx scripts/migrate-blobs-to-private.ts
 *
 * Safe to re-run: already-private blobs are skipped.
 */
import { list, put } from '@vercel/blob'

async function migrate(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN not configured')
  }

  let cursor: string | undefined
  let migrated = 0
  let skipped = 0
  let failed = 0

  do {
    const page = await list({ cursor, limit: 100 })

    for (const blob of page.blobs) {
      // Unauthenticated fetch: 200 means the blob is still public
      const response = await fetch(blob.url)

      if (response.status === 403 || response.status === 401) {
        skipped += 1
        continue
      }

      if (!response.ok) {
        console.error(`FAILED ${blob.pathname}: fetch returned ${response.status}`)
        failed += 1
        continue
      }

      const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
      const body = Buffer.from(await response.arrayBuffer())

      const result = await put(blob.pathname, body, {
        access: 'private',
        contentType,
        allowOverwrite: true,
      })

      if (result.url !== blob.url) {
        // Database rows store the old URL; flag any mismatch so those rows
        // can be updated manually.
        console.warn(`WARNING ${blob.pathname}: URL changed ${blob.url} -> ${result.url}`)
      }

      console.log(`migrated ${blob.pathname} (${body.length} bytes)`)
      migrated += 1
    }

    cursor = page.cursor
  } while (cursor)

  console.log(`\nDone. migrated=${migrated} already-private=${skipped} failed=${failed}`)

  if (failed > 0) {
    process.exitCode = 1
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error)
  process.exitCode = 1
})
