export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, 'qaqc_session')
  if (sessionId) {
    event.context.user = await getSessionUser(sessionId)
  }
})
