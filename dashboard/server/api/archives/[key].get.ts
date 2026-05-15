import { getArchiveIndex } from '#server/archive'

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Archive key is required' })
  }

  const database = getDatabase()
  const archive = await database
    .selectFrom('archives')
    .select(['type'])
    .where('prefix', '=', `archives/${key}`)
    .executeTakeFirst()

  if (archive?.type === 'internal') {
    requireAuth(event)
  }

  try {
    const plots = await getArchiveIndex(key)
    return plots
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Archive not found' })
  }
})
