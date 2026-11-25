import { ListObjectsV2Command } from '@aws-sdk/client-s3'

/**
 * Which days of a year an acoustic instrument has a published image, and which
 * days the OOI raw archive still holds source data for.
 *
 * A missing image with raw data behind it is a pipeline gap that can be
 * re-run; a missing image with no raw data is a genuine recording outage.
 */

const RAW_BASE = 'https://rawdata.oceanobservatories.org/files'

/**
 * Day-of-year numbers, 1-based, so the client can index a 365/366 slot rail.
 *
 * `rawKnown` is false when the instrument has no tree on the raw archive at all
 * — low-frequency hydrophones are sourced from IRIS via ooipy, not from here.
 * Without it an unanswerable question looks identical to "nothing was
 * recorded", which is the opposite of what this panel is for.
 */
export type Coverage = { year: number; images: number[]; raw: number[]; rawKnown: boolean }

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  return Math.round((date.getTime() - start) / 86_400_000) + 1
}

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365
}

/**
 * Published images for one sensor-year. One object per day, so a year is always
 * a single ListObjectsV2 page.
 */
export async function listImageDays(
  kind: 'spectrograms' | 'echograms',
  sensorId: string,
  year: number,
): Promise<number[]> {
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: QAQC_AWS_S3_BUCKET,
      Prefix: `${kind}/${year}/${sensorId}/`,
      MaxKeys: 1000,
    }),
  )

  const days = new Set<number>()
  for (const object of response.Contents ?? []) {
    const match = object.Key?.match(/_(\d{4})(\d{2})(\d{2})\.png$/)
    if (!match) continue
    const [, y, m, d] = match
    if (Number(y) !== year) continue
    days.add(dayOfYear(new Date(Date.UTC(year, Number(m) - 1, Number(d)))))
  }
  return [...days].sort((a, b) => a - b)
}

/**
 * Raw archive days for one month. The listing is an Apache index, so the day
 * directories are scraped from its hrefs.
 */
async function listRawDaysForMonth(refDes: string, year: number, month: number): Promise<number[]> {
  // RS03AXBS-LJ03A-09-HYDBBA302 -> RS03AXBS / LJ03A / HYDBBA302
  const [subsite, node] = refDes.split('-')
  const sensor = refDes.split('-').at(-1)
  const url = `${RAW_BASE}/${subsite}/${node}/${sensor}/${year}/${String(month).padStart(2, '0')}/`

  const response = await fetch(url)
  if (!response.ok) return [] // 404 simply means nothing was recorded that month
  const html = await response.text()

  const days = new Set<number>()
  for (const match of html.matchAll(/>(\d{2})\/</g)) {
    const day = Number(match[1])
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCMonth() !== month - 1) continue // guard against e.g. 31 Feb
    days.add(dayOfYear(date))
  }
  return [...days]
}

function instrumentUrl(refDes: string): string {
  const [subsite, node] = refDes.split('-')
  return `${RAW_BASE}/${subsite}/${node}/${refDes.split('-').at(-1)}/`
}

/** Whether this instrument publishes to the raw archive at all. */
async function hasRawTree(refDes: string): Promise<boolean> {
  try {
    const response = await fetch(instrumentUrl(refDes), { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Raw days for a year, fetched only for the months that actually contain an
 * image gap — a fully covered instrument costs no requests at all.
 *
 * Returns null when the instrument is absent from the archive, so the caller
 * can say "unknown" rather than "not recorded".
 */
export async function listRawDays(
  refDes: string,
  year: number,
  imageDays: number[],
): Promise<number[] | null> {
  const have = new Set(imageDays)
  const months = new Set<number>()
  for (let day = 1; day <= daysInYear(year); day++) {
    if (have.has(day)) continue
    const date = new Date(Date.UTC(year, 0, 1) + (day - 1) * 86_400_000)
    months.add(date.getUTCMonth() + 1)
  }
  if (months.size === 0) return []

  if (!(await hasRawTree(refDes))) return null

  const results = await Promise.all(
    [...months].map((month) =>
      listRawDaysForMonth(refDes, year, month).catch(() => [] as number[]),
    ),
  )
  return results.flat().sort((a, b) => a - b)
}
