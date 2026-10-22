import type { GetObjectCommandOutput } from '@aws-sdk/client-s3'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import type { H3Event } from 'h3'

// The pipelines write most objects without a ContentType, so S3 reports
// binary/octet-stream and the reverse proxy skips compressing them: index.json
// ships 6.3 MB instead of ~260 KB gzipped. Trust the extension where we know it.
const CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
}

// Acoustic images are named by date and only change when a day is re-run, so a
// longer TTL saves revalidation round trips without hiding a backfill for long.
const LONG_CACHE_PREFIXES = ['spectrograms/', 'echograms/']

function contentTypeFor(path: string): string | undefined {
  const extension = path.split('.').pop()?.toLowerCase()
  return extension ? CONTENT_TYPES[extension] : undefined
}

function maxAgeFor(path: string): number {
  const longCached = LONG_CACHE_PREFIXES.some((prefix) => path.startsWith(prefix))
  return longCached ? QAQC_AWS_S3_LONG_CACHE_MAX_AGE : QAQC_AWS_S3_CACHE_MAX_AGE
}

export async function proxyS3Path(event: H3Event, path: string) {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    return undefined
  }

  try {
    const ifNoneMatch = getHeader(event, 'if-none-match')
    const ifModifiedSince = getHeader(event, 'if-modified-since')
    const conditionalHeaders = {
      IfNoneMatch: ifNoneMatch || undefined,
      IfModifiedSince: ifModifiedSince ? new Date(ifModifiedSince) : undefined,
    }

    const command =
      event.method === 'HEAD'
        ? new HeadObjectCommand({ Bucket: QAQC_AWS_S3_BUCKET, Key: path, ...conditionalHeaders })
        : new GetObjectCommand({ Bucket: QAQC_AWS_S3_BUCKET, Key: path, ...conditionalHeaders })

    const response = await s3.send(command)

    const contentType = contentTypeFor(path) ?? response.ContentType
    if (contentType) {
      setHeader(event, 'Content-Type', contentType)
    }
    if (response.ContentLength) {
      setHeader(event, 'Content-Length', response.ContentLength)
    }
    if (response.ETag) {
      setHeader(event, 'ETag', response.ETag)
    }
    if (response.LastModified) {
      setHeader(event, 'Last-Modified', response.LastModified.toUTCString())
    }

    setHeader(event, 'Cache-Control', `public, max-age=${maxAgeFor(path)}`)

    if (event.method === 'HEAD') {
      event.node.res.end()
      return
    }

    return (response as GetObjectCommandOutput).Body?.transformToWebStream()
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
      throw createError({ statusCode: 404, statusMessage: 'Not found.' })
    }

    if (error.name === 'NotModified' || error.$metadata?.httpStatusCode === 304) {
      setResponseStatus(event, 304)
      event.node.res.end()
      return
    }

    throw error
  }
}
