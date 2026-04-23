import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import { createError, type H3Event } from 'h3'

import { getDatabase } from '#server/utils/db'

const scryptAsync = promisify(scrypt)

const SALT_LENGTH = 16
const KEY_LENGTH = 64
const SESSION_EXPIRY_DAYS = 7
const SESSION_ID_BYTES = 32

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'viewer'
  created_at: string
  updated_at: string
}

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

export function createSession(userId: string): string {
  const sessionId = randomBytes(SESSION_ID_BYTES).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const database = getDatabase()
  database
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sessionId, userId, expiresAt)
  return sessionId
}

export function getSessionUser(sessionId: string): User | null {
  const database = getDatabase()
  const now = new Date().toISOString()

  const row = database
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at, u.updated_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(sessionId, now) as User | undefined

  if (!row) {
    return null
  }

  const newExpiry = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  database.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(newExpiry, sessionId)

  return row
}

export function deleteSession(sessionId: string): void {
  const database = getDatabase()
  database.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function deleteExpiredSessions(): void {
  const database = getDatabase()
  const now = new Date().toISOString()
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
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
