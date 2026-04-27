import winston from 'winston'

const SERVICE_NAME = 'review-service'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp, service, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
          return `${timestamp} [${service}] ${level}: ${message}${metaStr}`
        })
      ),
    }),
  ],
})

export default logger
