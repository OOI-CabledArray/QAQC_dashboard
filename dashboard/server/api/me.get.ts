import { requireAuth } from '../utils/auth'

export default defineEventHandler((event) => {
  const user = requireAuth(event)
  return { id: user.id, email: user.email, name: user.name, role: user.role }
})
