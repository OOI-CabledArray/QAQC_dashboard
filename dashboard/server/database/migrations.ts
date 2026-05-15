import type Database from 'better-sqlite3'

interface Migration {
  version: string
  description: string
  up: (database: Database.Database) => void
}

const migrations: Migration[] = [
  {
    version: '001',
    description: 'create-users-and-sessions',
    up(database) {
      database.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
      `)
    },
  },
  {
    version: '002',
    description: 'create-archives',
    up(database) {
      database.exec(`
        CREATE TABLE archives (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          slug TEXT NOT NULL,
          prefix TEXT NOT NULL UNIQUE,
          name TEXT,
          trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual')),
          triggered_by TEXT,
          image_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE UNIQUE INDEX idx_archives_date_slug ON archives(date, slug);
      `)
    },
  },
  {
    version: '003',
    description: 'add-archive-status',
    up(database) {
      database.exec(`
        ALTER TABLE archives
          ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'
            CHECK (status IN ('pending', 'complete'));
      `)
    },
  },
  {
    version: '004',
    description: 'add-username-make-email-optional',
    up(database) {
      database.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT,
          name TEXT NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `)

      const rows = database
        .prepare('SELECT id, name, email, password, role, created_at, updated_at FROM users')
        .all() as any[]

      const usedUsernames = new Set<string>()
      const insert = database.prepare(`
        INSERT INTO users_new
          (id, username, email, name, password, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const row of rows) {
        let username = row.name.toLowerCase().replace(/\s+/g, '')
        if (usedUsernames.has(username)) {
          const emailPrefix = row.email.split('@')[0].toLowerCase()
          username = emailPrefix
        }
        let suffix = 2
        const base = username
        while (usedUsernames.has(username)) {
          username = `${base}${suffix}`
          suffix++
        }
        usedUsernames.add(username)
        const normalizedEmail = row.email?.trim().toLowerCase() || null
        insert.run(
          row.id,
          username,
          normalizedEmail,
          row.name,
          row.password,
          row.role,
          row.created_at,
          row.updated_at,
        )
      }

      database.exec(`
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `)
    },
  },
  {
    version: '005',
    description: 'add-archive-type',
    up(database) {
      database.exec(`
        ALTER TABLE archives
          ADD COLUMN type TEXT NOT NULL DEFAULT 'snapshot'
            CHECK (type IN ('snapshot', 'internal'));
      `)
    },
  },
]

export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row: any) => row.version),
  )

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue
    }

    database.transaction(() => {
      migration.up(database)
      database
        .prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)')
        .run(migration.version, migration.description)
    })()

    console.log(`Applied migration ${migration.version}, ${migration.description}.`)
  }
}
