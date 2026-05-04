import { scrypt, randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs, promisify } from 'node:util'

import Database from 'better-sqlite3'

import { runMigrations } from '../server/database/migrations'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

async function readPassword(): Promise<string> {
  process.stdout.write('Password: ')
  process.stdin.setRawMode(true)
  process.stdin.resume()

  return new Promise((resolve) => {
    let password = ''
    process.stdin.on('data', (chunk) => {
      const code = chunk[0]
      if (code === 0x0a || code === 0x0d || code === 0x04) {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdout.write('\n')
        resolve(password)
      } else if (code === 0x03) {
        process.stdin.setRawMode(false)
        process.stdout.write('\n')
        process.exit(1)
      } else if (code === 0x7f || code === 0x08) {
        if (password.length > 0) {
          password = password.slice(0, -1)
        }
      } else {
        password += chunk.toString()
      }
    })
  })
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
    },
    strict: true,
  })

  if (!values.email || !values.name) {
    console.error('Usage: npx tsx scripts/create-admin.ts --email <email> --name <name>')
    process.exit(1)
  }

  const password = await readPassword()
  if (!password) {
    console.error('Password cannot be empty.')
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
      .run(id, values.email, values.name, hashed, 'admin')
    console.log(`Admin user created for ${values.email}.`)
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      console.error(`A user with email ${values.email} already exists.`)
      process.exit(1)
    }
    throw error
  } finally {
    database.close()
  }
}

main()
