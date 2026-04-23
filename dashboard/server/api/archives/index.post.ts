import { requireAuth } from '../../utils/auth'
import { createArchive } from '../../utils/archive'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody(event)

  const archive = await createArchive({
    name: body?.name,
    triggeredBy: user.email,
  })
  return archive
})
