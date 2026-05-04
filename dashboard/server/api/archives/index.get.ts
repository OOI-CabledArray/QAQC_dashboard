import { getDatabase } from '#server/utils/db'

export default defineEventHandler(() => {
  const database = getDatabase()
  const archives = database
    .prepare("SELECT * FROM archives WHERE status = 'complete' ORDER BY created_at DESC")
    .all()
  return archives
})
