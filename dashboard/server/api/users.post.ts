import { requireAdmin, hashPassword } from '../utils/auth'
import { getDatabase } from '../utils/db'

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

  try {
    const result = database
      .prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(email, name, passwordHash, assignedRole)

    return { id: result.lastInsertRowid, email, name, role: assignedRole }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, statusMessage: 'A user with that email already exists' })
    }
    throw error
  }
})
