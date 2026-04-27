import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.ts'
import logger from './logger.ts'
import { createApp } from './app.ts'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required')

const PORT = process.env.PORT || 3001
const app = createApp(prisma, JWT_SECRET)

app.listen(PORT, () => {
  logger.info('user-service started', { port: PORT })
})
