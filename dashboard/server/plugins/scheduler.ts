import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

import { createArchive, cleanupArchives } from '#server/archive'
import { ENABLE_SCHEDULED_JOBS, QAQC_AWS_REGION } from '#server/utils/environment'

const require = createRequire(import.meta.url)
const cron = require('node-cron')

export default defineNitroPlugin(() => {
  if (!ENABLE_SCHEDULED_JOBS) {
    console.log('Scheduled jobs are disabled. Set ENABLE_SCHEDULED_JOBS=true to enable.')
    return
  }

  cron.schedule('0 2 * * *', async () => {
    console.log('Running daily archive job.')
    try {
      const archive = await createArchive({})
      console.log(`Daily archive created at ${archive.prefix} with ${archive.image_count} images.`)
    } catch (error) {
      console.error('Daily archive failed.', error)
    }
  })

  cron.schedule('0 3 * * 0', async () => {
    console.log('Running archive cleanup.')
    try {
      await cleanupArchives()
      console.log('Archive cleanup complete.')
    } catch (error) {
      console.error('Archive cleanup failed.', error)
    }
  })

  cron.schedule('0 4 * * *', async () => {
    console.log('Running database backup.')
    try {
      const database = getRawDatabase()
      const backupData = readFileSync(database.name)
      const date = new Date().toISOString().slice(0, 10)
      const s3 = new S3Client({ region: QAQC_AWS_REGION })
      await s3.send(
        new PutObjectCommand({
          Bucket: QAQC_AWS_S3_BUCKET,
          Key: `backups/db/${date}.sqlite`,
          Body: backupData,
        }),
      )
      console.log(`Database backed up to s3://${QAQC_AWS_S3_BUCKET}/backups/db/${date}.sqlite.`)
    } catch (error) {
      console.error('Database backup failed.', error)
    }
  })

  cron.schedule('0 * * * *', async () => {
    await deleteExpiredSessions()
  })

  console.log('Scheduled jobs registered.')
})
