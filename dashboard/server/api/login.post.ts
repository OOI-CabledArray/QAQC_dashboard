import { verifyPassword, createSession } from '#server/utils/auth'
import { getDatabase } from '#server/utils/db'

const SESSION_MAX_AGE = 7 * 24 * 60 * 60

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body ?? {}

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const database = getDatabase()
  const row = database
    .prepare('SELECT id, email, name, role, password FROM users WHERE email = ?')
    .get(email) as
    | { id: string; email: string; name: string; role: string; password: string }
    | undefined

  if (!row) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  const valid = await verifyPassword(password, row.password)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  const sessionId = createSession(row.id)

  setCookie(event, 'qaqc_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })

  return { id: row.id, email: row.email, name: row.name, role: row.role }
})
