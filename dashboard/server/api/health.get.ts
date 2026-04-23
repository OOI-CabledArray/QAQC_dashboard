import { getDatabase } from '#server/utils/db'

export default defineEventHandler(() => {
  const database = getDatabase()
  const result = database.prepare('SELECT 1 AS ok').get() as { ok: number }
  return { status: 'ok', database: result.ok === 1 }
})
