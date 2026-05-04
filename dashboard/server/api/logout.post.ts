export default defineEventHandler((event) => {
  requireAuth(event)

  const sessionId = getCookie(event, 'qaqc_session')
  if (sessionId) {
    deleteSession(sessionId)
  }

  deleteCookie(event, 'qaqc_session', { path: '/' })

  return { ok: true }
})
