import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import { createError, type H3Event } from 'h3'

import type { User } from '#server/database/types'

const scryptAsync = promisify(scrypt)

const SALT_LENGTH = 16
const KEY_LENGTH = 64
const SESSION_EXPIRY_DAYS = 7
const SESSION_ID_BYTES = 32

export type { User }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex')
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':') as [string, string]
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  const storedBuffer = Buffer.from(hash, 'hex')
  if (derived.length !== storedBuffer.length) {
    return false
  }
  return timingSafeEqual(derived, storedBuffer)
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(SESSION_ID_BYTES).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const database = getDatabase()
  await database
    .insertInto('sessions')
    .values({ id: sessionId, user_id: userId, expires_at: expiresAt })
    .execute()
  return sessionId
}

export async function getSessionUser(sessionId: string): Promise<User | null> {
  const database = getDatabase()
  const now = new Date().toISOString()

  const row = await database
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.user_id')
    .select([
      'users.id',
      'users.email',
      'users.name',
      'users.role',
      'users.created_at',
      'users.updated_at',
    ])
    .where('sessions.id', '=', sessionId)
    .where('sessions.expires_at', '>', now)
    .executeTakeFirst()

  if (!row) {
    return null
  }

  const newExpiry = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await database
    .updateTable('sessions')
    .set({ expires_at: newExpiry })
    .where('id', '=', sessionId)
    .execute()

  return row
}

export async function deleteSession(sessionId: string): Promise<void> {
  const database = getDatabase()
  await database.deleteFrom('sessions').where('id', '=', sessionId).execute()
}

export async function deleteExpiredSessions(): Promise<void> {
  const database = getDatabase()
  const now = new Date().toISOString()
  await database.deleteFrom('sessions').where('expires_at', '<=', now).execute()
}

export function requireAuth(event: H3Event): User {
  const user = event.context.user as User | undefined
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  return user
}

export function requireAdmin(event: H3Event): User {
  const user = requireAuth(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }
  return user
}
