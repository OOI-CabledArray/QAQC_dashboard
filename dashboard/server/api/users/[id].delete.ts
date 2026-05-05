export default defineEventHandler(async (event) => {
  const user = requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (id === user.id) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete your own account' })
  }

  const database = getDatabase()
  const result = await database.deleteFrom('users').where('id', '=', id!).executeTakeFirst()

  if (result.numDeletedRows === BigInt(0)) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return { ok: true }
})
