export default defineEventHandler(async (event) => {
  const currentUser = requireAdmin(event)

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { username, email, name, role } = body ?? {}

  const updates: Record<string, string | null> = {}
  if (username) {
    updates.username = username
  }
  if (email !== undefined) {
    updates.email = email ? validateAndNormalizeEmail(email) : null
  }
  if (name) {
    updates.name = name
  }
  if (role === 'admin' || role === 'viewer') {
    if (id === currentUser.id && role !== 'admin') {
      throw createError({ statusCode: 400, statusMessage: 'Cannot remove your own admin role.' })
    }
    updates.role = role
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update.' })
  }

  updates.updated_at = new Date().toISOString()

  const database = getDatabase()

  try {
    const result = await database
      .updateTable('users')
      .set(updates)
      .where('id', '=', id)
      .executeTakeFirst()

    if (result.numUpdatedRows === BigInt(0)) {
      throw createError({ statusCode: 404, statusMessage: 'User not found.' })
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A user with that username already exists.',
      })
    }
    throw error
  }

  const user = await database
    .selectFrom('users')
    .select(['id', 'username', 'email', 'name', 'role', 'created_at', 'updated_at'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow()

  return user
})
