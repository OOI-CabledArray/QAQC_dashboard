import { getDatabase } from '../../utils/db'

export default defineEventHandler(() => {
  const database = getDatabase()
  const archives = database.prepare('SELECT * FROM archives ORDER BY created_at DESC').all()
  return archives
})
