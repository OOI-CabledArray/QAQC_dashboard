import { Cron } from 'croner'

import { createArchive } from '#server/archive'
import { QAQC_ARCHIVE_SCHEDULE } from '#server/utils/environment'

const log = createLogger('archive-scheduler')

export default defineNitroPlugin(() => {
  if (!QAQC_ARCHIVE_SCHEDULE) {
    log.info('No archive schedule configured. Set QAQC_ARCHIVE_SCHEDULE in `.env` to enable.')
    return
  }

  log.info(`Scheduling archive job with cron expression: ${QAQC_ARCHIVE_SCHEDULE}`)

  Cron(QAQC_ARCHIVE_SCHEDULE, async () => {
    log.info('Running scheduled archive job.')
    try {
      const archive = await createArchive({})
      log.info(`Archive created at ${archive.prefix} with ${archive.image_count} images.`)
    } catch (error) {
      log.error('Scheduled archive job failed.', error)
    }
  })
})
