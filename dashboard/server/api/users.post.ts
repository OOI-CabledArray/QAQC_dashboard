import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const body = await readBody(event)
  const { username, email, name, password, role } = body ?? {}

  if (!username || !name || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username, name, and password are required.',
    })
  }

  const normalizedEmail = email ? validateAndNormalizeEmail(email) : null
  const passwordHash = await hashPassword(password)
  const assignedRole = role === 'admin' ? 'admin' : 'viewer'
  const database = getDatabase()
  const id = randomUUID()

  try {
    await database
      .insertInto('users')
      .values({
        id,
        username,
        email: normalizedEmail,
        name,
        password: passwordHash,
        role: assignedRole,
      })
      .execute()

    return { id, username, email: normalizedEmail, name, role: assignedRole }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A user with that username already exists.',
      })
    }
    throw error
  }
})
