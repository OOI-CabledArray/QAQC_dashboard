export default defineEventHandler(async (event) => {
  const user = event.context.user as { id: string } | null
  const { order } = getQuery(event)
  const database = getDatabase()

  let query = database.selectFrom('archives').selectAll()

  if (order === 'name') {
    query = query.orderBy('name', 'asc')
  } else {
    query = query.orderBy('created_at', 'desc')
  }

  if (!user) {
    query = query.where('type', '!=', 'internal')
  }

  const archives: Archive[] = await query.execute()
  return archives
})
