import { GetObjectCommand } from '@aws-sdk/client-s3'
import type { H3Event } from 'h3'

export async function proxyS3Path(event: H3Event, path: string) {
  try {
    const ifNoneMatch = getHeader(event, 'if-none-match')
    const ifModifiedSince = getHeader(event, 'if-modified-since')

    const response = await s3.send(
      new GetObjectCommand({
        Bucket: QAQC_AWS_S3_BUCKET,
        Key: path,
        IfNoneMatch: ifNoneMatch || undefined,
        IfModifiedSince: ifModifiedSince ? new Date(ifModifiedSince) : undefined,
      }),
    )

    if (response.ContentType) {
      setHeader(event, 'Content-Type', response.ContentType)
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

    setHeader(event, 'Cache-Control', `public, max-age=${QAQC_CACHE_MAX_AGE}`)

    return response.Body!.transformToWebStream()
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
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
