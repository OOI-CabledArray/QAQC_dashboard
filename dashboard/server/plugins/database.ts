import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { runMigrations } from '#server/database/migrations'

export default defineNitroPlugin(() => {
  const database = getRawDatabase()
  mkdirSync(dirname(database.name), { recursive: true })
  runMigrations(database)
  console.log(`Database initialized at ${database.name}.`)
})
