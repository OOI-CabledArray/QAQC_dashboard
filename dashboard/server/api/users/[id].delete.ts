import { requireAdmin } from '#server/utils/auth'
import { getDatabase } from '#server/utils/db'

export default defineEventHandler((event) => {
  const user = requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (id === user.id) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete your own account' })
  }

  const database = getDatabase()
  const result = database.prepare('DELETE FROM users WHERE id = ?').run(id)

  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return { ok: true }
})
