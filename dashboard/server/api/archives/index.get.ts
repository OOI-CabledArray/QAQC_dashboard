export default defineEventHandler(async () => {
  const database = getDatabase()
  const archives = await database
    .selectFrom('archives')
    .selectAll()
    .where('status', '=', 'complete')
    .orderBy('created_at', 'desc')
    .execute()
  return archives
})
