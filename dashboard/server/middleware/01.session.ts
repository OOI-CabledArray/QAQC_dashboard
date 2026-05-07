export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, 'session')
  if (sessionId) {
    event.context.user = await getSessionUser(sessionId)
  }
})
