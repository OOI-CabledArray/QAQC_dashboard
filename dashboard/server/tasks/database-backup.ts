import { readFileSync } from 'node:fs'

import { PutObjectCommand } from '@aws-sdk/client-s3'

import { QAQC_ENABLE_SCHEDULED_JOBS } from '#server/utils/environment'

const log = createLogger('tasks:database-backup')

export default defineTask({
  meta: {
    description: 'Back up the SQLite database to S3.',
  },
  async run() {
    if (!QAQC_ENABLE_SCHEDULED_JOBS) {
      return { result: 'skipped' }
    }

    log.info('Running database backup.')
    const database = getRawDatabase()
    const backupData = readFileSync(database.name)
    const date = new Date().toISOString().slice(0, 10)
    await s3.send(
      new PutObjectCommand({
        Bucket: QAQC_AWS_S3_BUCKET,
        Key: `backups/database/${date}.sqlite`,
        Body: backupData,
      }),
    )
    log.info(`Database backed up to s3://${QAQC_AWS_S3_BUCKET}/backups/database/${date}.sqlite.`)
    return { result: 'ok' }
  },
})
