import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const body = await readBody(event)
  const { email, name, password, role } = body ?? {}

  if (!email || !name || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email, name, and password are required' })
  }

  const passwordHash = await hashPassword(password)
  const assignedRole = role === 'admin' ? 'admin' : 'viewer'
  const database = getDatabase()
  const id = randomUUID()

  try {
    await database
      .insertInto('users')
      .values({ id, email, name, password: passwordHash, role: assignedRole })
      .execute()

    return { id, email, name, role: assignedRole }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, statusMessage: 'A user with that email already exists' })
    }
    throw error
  }
})
