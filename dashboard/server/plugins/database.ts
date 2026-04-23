import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { runMigrations } from '../database/migrations'
import { getDatabase } from '../utils/db'

export default defineNitroPlugin(() => {
  const database = getDatabase()
  mkdirSync(dirname(database.name), { recursive: true })
  runMigrations(database)
  console.log(`Database initialized at ${database.name}`)
})
