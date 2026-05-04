import { createArchive } from '#server/utils/archive'
import { requireAuth } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody(event)

  const archive = await createArchive({
    name: body?.name,
    triggeredBy: user.email,
  })
  return archive
})
