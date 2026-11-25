/**
 * Day-level coverage for one acoustic instrument and year.
 *
 *   /api/acoustic-coverage?kind=spectrograms&ref-des=RS03AXBS-LJ03A-09-HYDBBA302&year=2025
 *
 * `raw` is only consulted for months that contain an image gap, and is skipped
 * entirely unless asked for, so the rail can paint before it arrives.
 */

// Scraping the raw archive costs a request per gap month, and a past year never
// changes. Cached per instrument-year for the process lifetime.
const cache = new Map<string, { expires: number; value: Coverage }>()
const CURRENT_YEAR_TTL = 15 * 60 * 1000

export default defineEventHandler(async (event): Promise<Coverage> => {
  const query = getQuery(event)
  const kind = String(query.kind ?? '')
  const refDes = String(query.refDes ?? query['ref-des'] ?? '')
  const year = Number(query.year)
  const includeRaw = query.raw === '1' || query.raw === 'true'

  if (kind !== 'spectrograms' && kind !== 'echograms') {
    throw createError({ statusCode: 400, statusMessage: 'kind must be spectrograms or echograms.' })
  }
  if (!/^[A-Z0-9]+-[A-Z0-9]+-\d+-[A-Z0-9]+$/.test(refDes)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A full reference designator is required.',
    })
  }
  if (!Number.isInteger(year) || year < 2014 || year > new Date().getUTCFullYear()) {
    throw createError({ statusCode: 400, statusMessage: 'year is out of range.' })
  }

  const key = `${kind}:${refDes}:${year}:${includeRaw}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value

  const sensorId = refDes.split('-').at(-1) as string
  const images = await listImageDays(kind, sensorId, year)
  const raw = includeRaw ? await listRawDays(refDes, year, images) : []

  const value: Coverage = { year, images, raw: raw ?? [], rawKnown: includeRaw && raw !== null }
  const isCurrentYear = year === new Date().getUTCFullYear()
  cache.set(key, {
    value,
    expires: Date.now() + (isCurrentYear ? CURRENT_YEAR_TTL : 24 * 60 * 60 * 1000),
  })

  setHeader(event, 'Cache-Control', `public, max-age=${isCurrentYear ? 900 : 86400}`)
  return value
})
