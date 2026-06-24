export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { password } = body ?? {}

  if (!password) {
    throw createError({ statusCode: 400, statusMessage: 'Password is required.' })
  }

  const passwordHash = await hashPassword(password)
  const database = getDatabase()
  const result = await database
    .updateTable('users')
    .set({ password: passwordHash, updated_at: new Date().toISOString() })
    .where('id', '=', id)
    .executeTakeFirst()

  if (result.numUpdatedRows === BigInt(0)) {
    throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  }

  return { ok: true }
})
