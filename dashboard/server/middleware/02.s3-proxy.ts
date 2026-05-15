const S3_PREFIXES = [
  'QAQC_plots/',
  'discrete/',
  'HITL_notes/',
  'spectrograms/',
  'echograms/',
  'archives/',
]

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') {
    return
  }

  const path = event.path.slice(1)
  if (!S3_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return
  }

  if (path.startsWith('archives/')) {
    const archiveKey = path.slice('archives/'.length).split('/')[0]
    if (archiveKey) {
      const database = getDatabase()
      const archive = await database
        .selectFrom('archives')
        .select(['type'])
        .where('slug', '=', archiveKey)
        .where('type', '=', 'internal')
        .executeTakeFirst()

      if (archive) {
        requireAuth(event)
      }
    }
  }

  return proxyS3Path(event, path)
})
