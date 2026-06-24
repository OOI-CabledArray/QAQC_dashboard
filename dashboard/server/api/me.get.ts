export default defineEventHandler((event) => {
  const user = requireAuth(event)
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
  }
})
