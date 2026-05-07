import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { PutObjectCommand } from '@aws-sdk/client-s3'

import { createArchive, cleanupArchives } from '#server/archive'
import { ENABLE_SCHEDULED_JOBS } from '#server/utils/environment'

const log = createLogger('scheduler')

const require = createRequire(import.meta.url)
const cron = require('node-cron')

export default defineNitroPlugin(() => {
  if (!ENABLE_SCHEDULED_JOBS) {
    log.info('Scheduled jobs are disabled. Set ENABLE_SCHEDULED_JOBS=true in `.env` to enable.')
    return
  }

  cron.schedule('0 2 * * *', async () => {
    log.info('Running daily archive job.')
    try {
      const archive = await createArchive({})
      log.info(`Daily archive created at ${archive.prefix} with ${archive.image_count} images.`)
    } catch (error) {
      log.error('Daily archive failed.', error)
    }
  })

  cron.schedule('0 3 * * 0', async () => {
    log.info('Running archive cleanup.')
    try {
      await cleanupArchives()
      log.info('Archive cleanup complete.')
    } catch (error) {
      log.error('Archive cleanup failed.', error)
    }
  })

  cron.schedule('0 4 * * *', async () => {
    log.info('Running database backup.')
    try {
      const database = getRawDatabase()
      const backupData = readFileSync(database.name)
      const date = new Date().toISOString().slice(0, 10)
      await s3.send(
        new PutObjectCommand({
          Bucket: QAQC_AWS_S3_BUCKET,
          Key: `backups/db/${date}.sqlite`,
          Body: backupData,
        }),
      )
      log.info(`Database backed up to s3://${QAQC_AWS_S3_BUCKET}/backups/db/${date}.sqlite.`)
    } catch (error) {
      log.error('Database backup failed.', error)
    }
  })

  cron.schedule('0 * * * *', async () => {
    await deleteExpiredSessions()
  })

  log.info('Scheduled jobs registered.')
})
