import { GetObjectCommand } from '@aws-sdk/client-s3'
import type { H3Event } from 'h3'

export async function proxyS3Path(event: H3Event, path: string) {
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: QAQC_AWS_S3_BUCKET, Key: path }))

    if (response.ContentType) {
      setHeader(event, 'Content-Type', response.ContentType)
    }
    if (response.ContentLength) {
      setHeader(event, 'Content-Length', response.ContentLength)
    }
    setHeader(event, 'Cache-Control', 'public, max-age=86400')

    return response.Body!.transformToWebStream()
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      throw createError({ statusCode: 404, statusMessage: 'Not found.' })
    }
    throw error
  }
}
