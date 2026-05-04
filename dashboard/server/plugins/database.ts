import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { runMigrations } from '#server/database/migrations'

const log = createLogger('database')

export default defineNitroPlugin(() => {
  const database = getRawDatabase()
  mkdirSync(dirname(database.name), { recursive: true })
  runMigrations(database)
  log.info(`Database initialized at ${database.name}.`)
})
