export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const database = getDatabase()
  const users = await database
    .selectFrom('users')
    .select(['id', 'username', 'email', 'name', 'role', 'created_at', 'updated_at'])
    .orderBy('created_at', 'asc')
    .execute()

  return users
})
