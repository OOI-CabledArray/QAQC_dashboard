export default defineEventHandler(async (event) => {
  const user = event.context.user as { id: string } | null
  const database = getDatabase()

  let query = database.selectFrom('archives').selectAll().orderBy('created_at', 'desc')

  if (!user) {
    query = query.where('type', '!=', 'internal')
  }

  const archives: Archive[] = await query.execute()
  return archives
})
