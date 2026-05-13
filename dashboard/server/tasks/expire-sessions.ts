export default defineTask({
  meta: {
    description: 'Delete expired user sessions.',
  },
  async run() {
    await deleteExpiredSessions()
    return { result: 'ok' }
  },
})
