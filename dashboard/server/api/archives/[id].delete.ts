import { cancelArchive } from '#server/archive'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const id = getRouterParam(event, 'id')!
  await cancelArchive(id)

  return { ok: true }
})
