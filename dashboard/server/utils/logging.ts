import { createLogger as createWinstonLogger, format, transports } from 'winston'

const rootLogger = createWinstonLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message, module }) => {
      const prefix = module ? `[${module}]` : ''
      return `${timestamp} [${level.toUpperCase()}] ${prefix}: ${message}`
    }),
  ),
  transports: [new transports.Console()],
})

export function createLogger(module: string) {
  return rootLogger.child({ module })
}
