import "dotenv/config"
import pg from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma/client.ts"
import Redis from "ioredis"
import logger from "./logger.ts"
import { createApp } from "./app.ts"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const redis = new Redis(process.env.REDIS_URL!)

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL
const orderFetcher = {
  fetchOrders: (token: string) =>
    fetch(`${ORDER_SERVICE_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
}

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error("JWT_SECRET env var is required")

const PORT = process.env.PORT || 3004
const app = createApp(prisma, redis, orderFetcher, JWT_SECRET)

app.listen(PORT, () => {
  logger.info("review-service started", { port: PORT })
})
