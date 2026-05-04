import { randomUUID } from 'node:crypto'

import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'

import { getDatabase } from '#server/utils/db'
import { slugify } from '#server/utils/slugify'

const BUCKET = process.env.QAQC_S3_BUCKET || 'ooi-rca-qaqc-prod'
const REGION = process.env.AWS_REGION || 'us-west-2'
const SOURCE_PREFIX = 'QAQC_plots'

let s3Client: S3Client | null = null

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: REGION })
  }
  return s3Client
}

export type ArchiveRow = {
  id: string
  date: string
  slug: string
  prefix: string
  name: string | null
  trigger_type: 'scheduled' | 'manual'
  triggered_by: string | null
  image_count: number
  status: 'pending' | 'complete'
  created_at: string
}

export function buildArchiveKey(date: string, slug: string): string {
  return `${date}-${slug}`
}

export function buildArchivePrefix(date: string, slug: string): string {
  return `archives/${buildArchiveKey(date, slug)}`
}

export async function createArchive(options: {
  name?: string
  triggeredBy?: string
}): Promise<ArchiveRow> {
  const s3 = getS3()
  const database = getDatabase()
  const today = new Date().toISOString().slice(0, 10)
  const slug = options.name ? slugify(options.name) : 'auto'
  const triggerType = options.name ? 'manual' : 'scheduled'

  let finalSlug = slug
  const existing = database
    .prepare('SELECT id FROM archives WHERE date = ? AND slug = ?')
    .get(today, finalSlug) as { id: string } | undefined

  if (existing && finalSlug === 'auto') {
    await deleteArchiveFromS3(buildArchivePrefix(today, finalSlug))
    database.prepare('DELETE FROM archives WHERE id = ?').run(existing.id)
  } else if (existing) {
    let counter = 2
    while (
      database
        .prepare('SELECT id FROM archives WHERE date = ? AND slug = ?')
        .get(today, `${slug}-${counter}`)
    ) {
      counter++
    }
    finalSlug = `${slug}-${counter}`
  }

  const prefix = buildArchivePrefix(today, finalSlug)

  const indexResponse = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: `${SOURCE_PREFIX}/index.json` }),
  )
  const indexBody = await indexResponse.Body!.transformToString()
  const plotFiles = JSON.parse(indexBody) as string[]

  const allKeys = [`${SOURCE_PREFIX}/index.json`, ...plotFiles.map((f) => `${SOURCE_PREFIX}/${f}`)]

  const id = randomUUID()
  database
    .prepare(
      `INSERT INTO archives (id, date, slug, prefix, name, trigger_type, triggered_by, image_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(
      id,
      today,
      finalSlug,
      prefix,
      options.name || null,
      triggerType,
      options.triggeredBy || null,
      plotFiles.length,
    )

  console.log(`Archiving ${allKeys.length} files to ${prefix}.`)

  const batchSize = 50
  let copied = 0
  for (let i = 0; i < allKeys.length; i += batchSize) {
    const batch = allKeys.slice(i, i + batchSize)
    await Promise.all(
      batch.map((sourceKey) => {
        const destinationKey = sourceKey.replace(SOURCE_PREFIX, prefix)
        return s3.send(
          new CopyObjectCommand({
            Bucket: BUCKET,
            CopySource: `${BUCKET}/${sourceKey}`,
            Key: destinationKey,
          }),
        )
      }),
    )
    copied += batch.length
    console.log(`  Copied ${copied}/${allKeys.length} files.`)
  }

  database.prepare("UPDATE archives SET status = 'complete' WHERE id = ?").run(id)

  return database.prepare('SELECT * FROM archives WHERE id = ?').get(id) as ArchiveRow
}

async function deleteArchiveFromS3(prefix: string) {
  const s3 = getS3()
  let continuationToken: string | undefined

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )

    if (list.Contents && list.Contents.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: list.Contents.map((object) => ({ Key: object.Key })) },
        }),
      )
    }

    continuationToken = list.NextContinuationToken
  } while (continuationToken)
}

export function findArchivesToDelete(
  archives: Pick<ArchiveRow, 'id' | 'date' | 'slug' | 'trigger_type' | 'name'>[],
  now: Date,
): string[] {
  const toDelete: string[] = []

  for (const archive of archives) {
    if (archive.trigger_type === 'manual' && archive.name) {
      continue
    }

    const archiveDate = new Date(archive.date + 'T00:00:00Z')
    const ageDays = Math.floor((now.getTime() - archiveDate.getTime()) / (1000 * 60 * 60 * 24))

    if (ageDays < 30) {
      continue
    }

    if (ageDays < 180) {
      const dayOfWeek = archiveDate.getUTCDay()
      if (dayOfWeek !== 0) {
        toDelete.push(archive.id)
      }
    } else {
      const dayOfMonth = archiveDate.getUTCDate()
      if (dayOfMonth !== 1) {
        toDelete.push(archive.id)
      }
    }
  }

  return toDelete
}

export async function runCleanup() {
  const database = getDatabase()
  const archives = database.prepare('SELECT * FROM archives').all() as ArchiveRow[]

  const stalePending = archives.filter((archive) => {
    if (archive.status !== 'pending') {
      return false
    }
    const created = new Date(archive.created_at + 'Z')
    return Date.now() - created.getTime() > 60 * 60 * 1000
  })

  for (const archive of stalePending) {
    await deleteArchiveFromS3(archive.prefix)
    database.prepare('DELETE FROM archives WHERE id = ?').run(archive.id)
    console.log(`Cleaned up stale pending archive ${archive.prefix}.`)
  }

  const completeArchives = archives.filter((archive) => archive.status === 'complete')
  const toDelete = findArchivesToDelete(completeArchives, new Date())

  for (const id of toDelete) {
    const archive = completeArchives.find((row) => row.id === id)
    if (archive) {
      await deleteArchiveFromS3(archive.prefix)
      database.prepare('DELETE FROM archives WHERE id = ?').run(id)
      console.log(`Deleted archive ${archive.prefix} per retention policy.`)
    }
  }
}

export async function getArchiveIndex(key: string): Promise<string[]> {
  const s3 = getS3()
  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: `archives/${key}/index.json` }),
  )
  const body = await response.Body!.transformToString()
  return JSON.parse(body)
}
