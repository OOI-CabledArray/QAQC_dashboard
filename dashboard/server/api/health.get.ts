import { sql } from 'kysely'

export default defineEventHandler(async () => {
  const database = getDatabase()
  const result = await sql<{ ok: number }>`SELECT 1 AS ok`.execute(database)
  return { status: 'ok', database: result.rows[0]?.ok === 1 }
})
