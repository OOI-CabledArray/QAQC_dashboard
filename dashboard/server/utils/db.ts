import { join } from 'node:path'

import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

import type { Database as DatabaseSchema } from '#server/database/types'

const DB_PATH = process.env.QAQC_DB_PATH || join(process.cwd(), 'data', 'qaqc.sqlite')

let rawDatabase: Database.Database | null = null
let database: Kysely<DatabaseSchema> | null = null

export function getRawDatabase(): Database.Database {
  if (!rawDatabase) {
    rawDatabase = new Database(DB_PATH)
    rawDatabase.pragma('foreign_keys = ON')
  }
  return rawDatabase
}

export function getDatabase(): Kysely<DatabaseSchema> {
  if (!database) {
    database = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: getRawDatabase(),
      }),
    })
  }
  return database
}
