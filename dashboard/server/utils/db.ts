import { join } from 'node:path'

import Database from 'better-sqlite3'

const DB_PATH = process.env.QAQC_DB_PATH || join(process.cwd(), 'data', 'qaqc.sqlite')

let database: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!database) {
    database = new Database(DB_PATH)
    database.pragma('journal_mode = WAL')
    database.pragma('foreign_keys = ON')
  }
  return database
}
