const SESSION_MAX_AGE = 7 * 24 * 60 * 60

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body ?? {}

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const database = getDatabase()
  const row = await database
    .selectFrom('users')
    .select(['id', 'email', 'name', 'role', 'password'])
    .where('email', '=', email)
    .executeTakeFirst()

  if (!row) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  const valid = await verifyPassword(password, row.password)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  const sessionId = await createSession(row.id)

  setCookie(event, 'qaqc_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })

  return { id: row.id, email: row.email, name: row.name, role: row.role }
})
