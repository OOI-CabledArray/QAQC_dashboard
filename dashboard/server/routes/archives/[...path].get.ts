import { GetObjectCommand } from '@aws-sdk/client-s3'

import { QAQC_AWS_S3_BUCKET } from '#server/utils/environment'

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path')
  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing path' })
  }

  const key = `archives/${path}`

  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: QAQC_AWS_S3_BUCKET, Key: key }))

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
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
    throw error
  }
})
