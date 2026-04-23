import { getArchiveIndex } from '../../utils/archive'

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Archive key is required' })
  }

  try {
    const plots = await getArchiveIndex(key)
    return plots
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Archive not found' })
  }
})
