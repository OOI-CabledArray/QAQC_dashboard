import { randomUUID } from 'node:crypto'

import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'

import type { Archive } from '#server/database/types'
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

export type { Archive }

export function buildArchiveKey(date: string, slug: string): string {
  return `${date}-${slug}`
}

export function buildArchivePrefix(date: string, slug: string): string {
  return `archives/${buildArchiveKey(date, slug)}`
}

export async function createArchive(options: {
  name?: string
  triggeredBy?: string
}): Promise<Archive> {
  const s3 = getS3()
  const database = getDatabase()
  const today = new Date().toISOString().slice(0, 10)
  const slug = options.name ? slugify(options.name) : 'auto'
  const triggerType = options.name ? 'manual' : 'scheduled'

  let finalSlug = slug
  const existing = await database
    .selectFrom('archives')
    .select('id')
    .where('date', '=', today)
    .where('slug', '=', finalSlug)
    .executeTakeFirst()

  if (existing && finalSlug === 'auto') {
    await deleteArchiveFromS3(buildArchivePrefix(today, finalSlug))
    await database.deleteFrom('archives').where('id', '=', existing.id).execute()
  } else if (existing) {
    let counter = 2
    while (
      await database
        .selectFrom('archives')
        .select('id')
        .where('date', '=', today)
        .where('slug', '=', `${slug}-${counter}`)
        .executeTakeFirst()
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
  await database
    .insertInto('archives')
    .values({
      id,
      date: today,
      slug: finalSlug,
      prefix,
      name: options.name || null,
      trigger_type: triggerType,
      triggered_by: options.triggeredBy || null,
      image_count: plotFiles.length,
      status: 'pending',
    })
    .execute()

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

  await database.updateTable('archives').set({ status: 'complete' }).where('id', '=', id).execute()

  const archive = await database
    .selectFrom('archives')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()

  return archive
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
  archives: Pick<Archive, 'id' | 'date' | 'slug' | 'trigger_type' | 'name'>[],
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
  const archives = await database.selectFrom('archives').selectAll().execute()

  const stalePending = archives.filter((archive) => {
    if (archive.status !== 'pending') {
      return false
    }
    const created = new Date(archive.created_at + 'Z')
    return Date.now() - created.getTime() > 60 * 60 * 1000
  })

  for (const archive of stalePending) {
    await deleteArchiveFromS3(archive.prefix)
    await database.deleteFrom('archives').where('id', '=', archive.id).execute()
    console.log(`Cleaned up stale pending archive ${archive.prefix}.`)
  }

  const completeArchives = archives.filter((archive) => archive.status === 'complete')
  const toDelete = findArchivesToDelete(completeArchives, new Date())

  for (const id of toDelete) {
    const archive = completeArchives.find((row) => row.id === id)
    if (archive) {
      await deleteArchiveFromS3(archive.prefix)
      await database.deleteFrom('archives').where('id', '=', id).execute()
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
