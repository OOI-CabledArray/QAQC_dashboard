import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

import type { Database as DatabaseSchema } from '#server/database/types'

export function openDatabase(path: string): Database.Database {
  const database = new Database(path)
  database.pragma('foreign_keys = ON')
  return database
}

let raw: Database.Database | null = null
let database: Kysely<DatabaseSchema> | null = null

export function getRawDatabase(): Database.Database {
  if (raw == null) {
    raw = openDatabase(QAQC_DATABASE)
  }

  return raw
}

export function getDatabase(): Kysely<DatabaseSchema> {
  if (database == null) {
    database = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: getRawDatabase(),
      }),
    })
  }

  return database
}
