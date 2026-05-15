import validator from 'validator'

const { isEmail, normalizeEmail } = validator

export function validateAndNormalizeEmail(email: string): string {
  const trimmed = email.trim()
  if (!isEmail(trimmed)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email address' })
  }
  const normalized = normalizeEmail(trimmed)
  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email address' })
  }
  return normalized
}
