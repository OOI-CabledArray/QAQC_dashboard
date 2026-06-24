import { registerInternalArchive } from '#server/archive'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required.' })
  }

  return await registerInternalArchive(body.name)
})
