import type { Generated, Insertable, Selectable } from 'kysely'

export interface UsersTable {
  id: string
  username: string
  email: string | null
  name: string
  password: string
  role: 'admin' | 'viewer'
  created_at: Generated<string>
  updated_at: Generated<string>
}

export interface SessionsTable {
  id: string
  user_id: string
  expires_at: string
  created_at: Generated<string>
}

export interface ArchivesTable {
  id: string
  date: string
  slug: string
  prefix: string
  name: string | null
  type: Generated<'scheduled' | 'event' | 'internal'>
  triggered_by: string | null
  image_count: number
  status: Generated<'pending' | 'complete'>
  created_at: Generated<string>
}

export interface Database {
  users: UsersTable
  sessions: SessionsTable
  archives: ArchivesTable
}

export type User = Pick<
  Selectable<UsersTable>,
  'id' | 'username' | 'email' | 'name' | 'role' | 'created_at' | 'updated_at'
>

export type Archive = Selectable<ArchivesTable>
export type NewArchive = Insertable<ArchivesTable>
