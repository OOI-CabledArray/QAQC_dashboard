import { readFileSync } from 'node:fs'

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import cron from 'node-cron'

const ENABLE_JOBS = process.env.ENABLE_SCHEDULED_JOBS === 'true'
const BUCKET = process.env.QAQC_S3_BUCKET || 'ooi-rca-qaqc-prod'

export default defineNitroPlugin(() => {
  if (!ENABLE_JOBS) {
    console.log('Scheduled jobs disabled (set ENABLE_SCHEDULED_JOBS=true to enable)')
    return
  }

  cron.schedule('0 2 * * *', async () => {
    console.log('Running daily archive job...')
    try {
      const archive = await createArchive({})
      console.log(`Daily archive created: ${archive.prefix} (${archive.image_count} images)`)
    } catch (error) {
      console.error('Daily archive failed:', error)
    }
  })

  cron.schedule('0 3 * * 0', async () => {
    console.log('Running retention thinning...')
    try {
      await runRetention()
      console.log('Retention thinning complete.')
    } catch (error) {
      console.error('Retention thinning failed:', error)
    }
  })

  cron.schedule('0 4 * * *', async () => {
    console.log('Running database backup...')
    try {
      const database = getDatabase()
      const backupData = readFileSync(database.name)
      const date = new Date().toISOString().slice(0, 10)
      const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' })
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: `backups/db/${date}.sqlite`,
          Body: backupData,
        }),
      )
      console.log(`Database backed up to s3://${BUCKET}/backups/db/${date}.sqlite`)
    } catch (error) {
      console.error('Database backup failed:', error)
    }
  })

  cron.schedule('0 * * * *', () => {
    deleteExpiredSessions()
  })

  console.log(
    'Scheduled jobs registered: daily archive (02:00), retention (Sun 03:00), DB backup (04:00), session cleanup (hourly)',
  )
})
