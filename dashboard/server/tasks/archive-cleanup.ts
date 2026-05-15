import { cleanupArchives } from '#server/archive'

const log = createLogger('tasks:archive-cleanup')

export default defineTask({
  meta: {
    description: 'Clean up stale, orphaned, and expired archives.',
  },
  async run() {
    log.info('Running archive cleanup.')
    await cleanupArchives()
    log.info('Archive cleanup complete.')
    return { result: 'ok' }
  },
})
