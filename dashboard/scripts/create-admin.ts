import Database from 'better-sqlite3'
import { scrypt, randomBytes, randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { runMigrations } from '../server/database/migrations'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

async function main() {
  const email = process.argv[2]
  const name = process.argv[3]
  const password = process.argv[4]

  if (!email || !name || !password) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <name> <password>')
    process.exit(1)
  }

  const databasePath = process.env.QAQC_DB_PATH || join(process.cwd(), 'data', 'qaqc.sqlite')
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })

  const database = new Database(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  runMigrations(database)

  const id = randomUUID()
  const hashed = await hashPassword(password)

  try {
    database
      .prepare('INSERT INTO users (id, email, name, password, role) VALUES (?, ?, ?, ?, ?)')
      .run(id, email, name, hashed, 'admin')
    console.log(`Admin user created: ${email}`)
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      console.error(`A user with email ${email} already exists.`)
      process.exit(1)
    }
    throw error
  } finally {
    database.close()
  }
}

main()
