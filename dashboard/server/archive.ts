import { randomUUID } from 'node:crypto'

import {
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'

import type { Archive } from '#server/database/types'
import { createLogger } from '#server/utils/logging'
import { slugify } from '#server/utils/slugify'

const log = createLogger('archive')

const SOURCE_PREFIX = 'QAQC_plots'

export type { Archive }

const activeCopies = new Map<string, AbortController>()

export function buildArchiveKey(
  type: 'scheduled' | 'event' | 'internal',
  date: string,
  slug: string,
): string {
  if (type === 'scheduled') {
    return `${type}/${date}`
  }
  if (type === 'internal') {
    return `${type}/${slug}`
  }
  return `${type}/${date}-${slug}`
}

export function buildArchivePrefix(
  type: 'scheduled' | 'event' | 'internal',
  date: string,
  slug: string,
): string {
  return `archives/${buildArchiveKey(type, date, slug)}`
}

export async function createArchive(options: { name?: string }): Promise<Archive> {
  const database = getDatabase()
  const today = new Date().toISOString().slice(0, 10)
  const type = options.name ? 'event' : 'scheduled'

  let slug = options.name ? slugify(options.name) : ''

  if (type === 'scheduled') {
    const existing = await database
      .selectFrom('archives')
      .select('id')
      .where('type', '=', 'scheduled')
      .where('date', '=', today)
      .executeTakeFirst()

    if (existing) {
      await deleteArchiveFromS3(buildArchivePrefix('scheduled', today, ''))
      await database.deleteFrom('archives').where('id', '=', existing.id).execute()
    }
  } else {
    const existing = await database
      .selectFrom('archives')
      .select('id')
      .where('type', '=', 'event')
      .where('date', '=', today)
      .where('slug', '=', slug)
      .executeTakeFirst()

    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: 'An event archive with that name already exists for today.',
      })
    }
  }

  const prefix = buildArchivePrefix(type, today, slug)

  const sourceKeys = await listAllKeys(SOURCE_PREFIX)

  const id = randomUUID()
  await database
    .insertInto('archives')
    .values({
      id,
      date: today,
      slug,
      prefix,
      name: options.name || null,
      type,

      status: 'pending',
    })
    .execute()

  const archive = await database
    .selectFrom('archives')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()

  const abortController = new AbortController()
  activeCopies.set(id, abortController)

  copyArchiveFiles(id, prefix, sourceKeys, abortController.signal)
    .catch(async (error) => {
      if (abortController.signal.aborted) {
        return
      }
      log.error(`Archive copy failed for ${prefix}.`, error)
      try {
        await deleteArchiveFromS3(prefix)
        await database.deleteFrom('archives').where('id', '=', id).execute()
        log.info(`Cleaned up failed archive ${prefix}.`)
      } catch (cleanupError) {
        log.error(`Failed to clean up archive ${prefix}.`, cleanupError)
      }
    })
    .finally(() => {
      activeCopies.delete(id)
    })

  return archive
}

export async function registerInternalArchive(name: string): Promise<Archive> {
  const database = getDatabase()
  const slug = slugify(name)

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid archive name.' })
  }

  const existing = await database
    .selectFrom('archives')
    .select('id')
    .where('type', '=', 'internal')
    .where('slug', '=', slug)
    .executeTakeFirst()

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An internal archive with that name already exists.',
    })
  }

  const prefix = buildArchivePrefix('internal', '', slug)

  const sourceKeys = await listAllKeys(SOURCE_PREFIX)

  const id = randomUUID()
  await database
    .insertInto('archives')
    .values({
      id,
      date: '',
      slug,
      prefix,
      name,
      type: 'internal',
      status: 'pending',
    })
    .execute()

  const archive = await database
    .selectFrom('archives')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()

  const abortController = new AbortController()
  activeCopies.set(id, abortController)

  copyArchiveFiles(id, prefix, sourceKeys, abortController.signal)
    .catch(async (error) => {
      if (abortController.signal.aborted) {
        return
      }
      log.error(`Archive copy failed for ${prefix}.`, error)
      try {
        await deleteArchiveFromS3(prefix)
        await database.deleteFrom('archives').where('id', '=', id).execute()
        log.info(`Cleaned up failed archive ${prefix}.`)
      } catch (cleanupError) {
        log.error(`Failed to clean up archive ${prefix}.`, cleanupError)
      }
    })
    .finally(() => {
      activeCopies.delete(id)
    })

  return archive
}

async function listAllKeys(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: QAQC_AWS_S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )

    if (list.Contents) {
      for (const object of list.Contents) {
        if (object.Key) {
          keys.push(object.Key)
        }
      }
    }

    continuationToken = list.NextContinuationToken
  } while (continuationToken)

  return keys
}

async function copyArchiveFiles(
  archiveId: string,
  prefix: string,
  sourceKeys: string[],
  signal: AbortSignal,
): Promise<void> {
  const database = getDatabase()

  log.info(`Archiving ${sourceKeys.length} files to ${prefix}.`)

  const concurrency = 200
  let active = 0
  let completed = 0
  let failed = 0
  const queue = [...sourceKeys]

  await new Promise<void>((resolve, reject) => {
    function next() {
      if (signal.aborted) {
        if (active === 0) {
          reject(new Error('Aborted'))
        }
        return
      }
      if (completed + failed >= sourceKeys.length) {
        resolve()
        return
      }
      while (active < concurrency && queue.length > 0) {
        const sourceKey = queue.shift()!
        const destinationKey = `${prefix}/${sourceKey}`
        active++
        s3.send(
          new CopyObjectCommand({
            Bucket: QAQC_AWS_S3_BUCKET,
            CopySource: `${QAQC_AWS_S3_BUCKET}/${sourceKey}`,
            Key: destinationKey,
          }),
        )
          .then(() => {
            active--
            completed++
            if (completed % 1000 === 0) {
              log.info(`Copied ${completed}/${sourceKeys.length} files to ${prefix}.`)
            }
            next()
          })
          .catch((error) => {
            active--
            failed++
            log.warn(`Failed to copy ${sourceKey}: ${error.message}`)
            next()
          })
      }
    }
    next()
  })

  log.info(`Copied ${completed} files to ${prefix}.${failed > 0 ? ` ${failed} files failed.` : ''}`)

  await database
    .updateTable('archives')
    .set({ status: 'complete' })
    .where('id', '=', archiveId)
    .execute()

  log.info(`Archive ${prefix} complete.`)
}

async function deleteArchiveFromS3(prefix: string) {
  let continuationToken: string | undefined
  let deleted = 0

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: QAQC_AWS_S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )

    if (list.Contents && list.Contents.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: QAQC_AWS_S3_BUCKET,
          Delete: { Objects: list.Contents.map((object) => ({ Key: object.Key })) },
        }),
      )
      deleted += list.Contents.length
      log.info(`Deleted ${deleted} files from ${prefix}.`)
    }

    continuationToken = list.NextContinuationToken
  } while (continuationToken)
}

export function findArchivesToDelete(
  archives: Pick<Archive, 'id' | 'date' | 'slug' | 'name' | 'type'>[],
  now: Date,
): string[] {
  const toDelete: string[] = []

  for (const archive of archives) {
    if (archive.type === 'internal') {
      continue
    }

    if (archive.type === 'event' && archive.name) {
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

export async function cancelArchive(id: string): Promise<void> {
  const database = getDatabase()
  const archive = await database
    .selectFrom('archives')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()

  if (!archive) {
    return
  }

  const controller = activeCopies.get(id)
  if (controller) {
    controller.abort()
    activeCopies.delete(id)
  }

  await database.deleteFrom('archives').where('id', '=', id).execute()
  log.info(`Deleted archive record ${archive.prefix}.`)

  deleteArchiveFromS3(archive.prefix)
    .then(() => log.info(`Cleaned up S3 files for ${archive.prefix}.`))
    .catch((error) => log.error(`Failed to clean up S3 files for ${archive.prefix}.`, error))
}

export async function cleanupArchives() {
  const database = getDatabase()
  const archives = await database.selectFrom('archives').selectAll().execute()

  const snapshotArchives = archives.filter((archive) => archive.type !== 'internal')

  const stalePending = snapshotArchives.filter((archive) => {
    if (archive.status !== 'pending') {
      return false
    }
    const created = new Date(archive.created_at + 'Z')
    return Date.now() - created.getTime() > 60 * 60 * 1000
  })

  for (const archive of stalePending) {
    await deleteArchiveFromS3(archive.prefix)
    await database.deleteFrom('archives').where('id', '=', archive.id).execute()
    log.info(`Cleaned up stale pending archive ${archive.prefix}.`)
  }

  const completeArchives = snapshotArchives.filter((archive) => archive.status === 'complete')

  for (const archive of completeArchives) {
    try {
      await s3.send(
        new HeadObjectCommand({
          Bucket: QAQC_AWS_S3_BUCKET,
          Key: `${archive.prefix}/${SOURCE_PREFIX}/index.json`,
        }),
      )
    } catch (error: any) {
      if (error.name === 'NotFound') {
        await database.deleteFrom('archives').where('id', '=', archive.id).execute()
        log.info(`Removed orphaned archive record ${archive.prefix}.`)
      }
    }
  }

  const toDelete = findArchivesToDelete(completeArchives, new Date())

  for (const id of toDelete) {
    const archive = completeArchives.find((row) => row.id === id)
    if (archive) {
      await deleteArchiveFromS3(archive.prefix)
      await database.deleteFrom('archives').where('id', '=', id).execute()
      log.info(`Deleted ${archive.prefix} per retention policy.`)
    }
  }
}

export async function getArchiveIndex(key: string): Promise<string[]> {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: QAQC_AWS_S3_BUCKET,
      Key: `archives/${key}/${SOURCE_PREFIX}/index.json`,
    }),
  )
  const body = await response.Body!.transformToString()
  return JSON.parse(body)
}
