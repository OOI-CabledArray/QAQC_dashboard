export default defineEventHandler(async () => {
  const database = getDatabase()
  const archives = await database
    .selectFrom('archives')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute()
  return archives
})
