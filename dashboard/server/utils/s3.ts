import { Agent } from 'node:https'

import { S3Client } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'

export const s3 = new S3Client({
  region: QAQC_AWS_REGION,
  requestHandler: new NodeHttpHandler({
    httpsAgent: new Agent({ maxSockets: 200 }),
  }),
})
