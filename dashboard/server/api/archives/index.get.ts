export default defineEventHandler(async () => {
  const database = getDatabase()
  const archives: Archive[] = await database
    .selectFrom('archives')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute()
  return archives
})
