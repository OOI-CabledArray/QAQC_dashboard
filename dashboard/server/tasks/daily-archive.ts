import { createArchive } from '#server/archive'
import { QAQC_ENABLE_SCHEDULED_JOBS } from '#server/utils/environment'

const log = createLogger('tasks:daily-archive')

export default defineTask({
  meta: {
    description: 'Create a daily archive snapshot of all plot images.',
  },
  async run() {
    if (!QAQC_ENABLE_SCHEDULED_JOBS) {
      return { result: 'skipped' }
    }

    log.info('Running daily archive job.')
    const archive = await createArchive({})
    log.info(`Daily archive created at ${archive.prefix} with ${archive.image_count} images.`)
    return { result: 'ok' }
  },
})
