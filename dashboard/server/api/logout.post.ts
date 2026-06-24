export default defineEventHandler((event) => {
  requireAuth(event)

  const sessionId = getCookie(event, 'session')
  if (sessionId) {
    deleteSession(sessionId)
  }

  deleteCookie(event, 'session', { path: '/' })

  return { ok: true }
})
