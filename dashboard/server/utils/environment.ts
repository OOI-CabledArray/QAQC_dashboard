import { existsSync } from 'node:fs'
import { join } from 'node:path'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    const dotenvExists = existsSync(join(process.cwd(), '.env'))
    if (!dotenvExists) {
      throw new Error(
        `Environment variable \`${name}\` is required. Create a \`.env\` file based on \`.env.example\`.`,
      )
    }
    throw new Error(`Environment variable \`${name}\` is required. Set it in \`.env\`.`)
  }
  return value
}

export const QAQC_AWS_S3_BUCKET = requireEnv('QAQC_AWS_S3_BUCKET')
export const QAQC_AWS_REGION = requireEnv('QAQC_AWS_REGION')
export const QAQC_DATABASE =
  process.env.QAQC_DATABASE || join(process.cwd(), 'data', 'database.sqlite')
export const ENABLE_SCHEDULED_JOBS = process.env.ENABLE_SCHEDULED_JOBS === 'true'
