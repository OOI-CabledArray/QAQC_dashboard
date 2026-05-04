import { join } from 'node:path'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} environment variable is required.`)
  }
  return value
}

export const QAQC_AWS_S3_BUCKET = requireEnv('QAQC_AWS_S3_BUCKET')
export const QAQC_AWS_REGION = requireEnv('QAQC_AWS_REGION')
export const QAQC_DATABASE =
  process.env.QAQC_DATABASE || join(process.cwd(), 'data', 'database.sqlite')
export const ENABLE_SCHEDULED_JOBS = process.env.ENABLE_SCHEDULED_JOBS === 'true'
