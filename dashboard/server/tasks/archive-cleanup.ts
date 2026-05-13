import { cleanupArchives } from '#server/archive'
import { QAQC_ENABLE_SCHEDULED_JOBS } from '#server/utils/environment'

const log = createLogger('tasks:archive-cleanup')

export default defineTask({
  meta: {
    description: 'Clean up stale, orphaned, and expired archives.',
  },
  async run() {
    if (!QAQC_ENABLE_SCHEDULED_JOBS) {
      return { result: 'skipped' }
    }

    log.info('Running archive cleanup.')
    await cleanupArchives()
    log.info('Archive cleanup complete.')
    return { result: 'ok' }
  },
})
