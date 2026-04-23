import { getSessionUser } from '../utils/auth'

export default defineEventHandler((event) => {
  const sessionId = getCookie(event, 'qaqc_session')
  if (sessionId) {
    event.context.user = getSessionUser(sessionId)
  }
})
