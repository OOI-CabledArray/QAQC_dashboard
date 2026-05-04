import { createArchive } from '#server/archive'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required for event archives' })
  }

  const archive = await createArchive({
    name: body.name,
    triggeredBy: user.email,
  })
  return archive
})
