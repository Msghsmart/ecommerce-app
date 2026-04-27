import "dotenv/config"
import pg from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma/client.ts"
import { Kafka } from "kafkajs"
import logger from "./logger.ts"
import { createApp } from "./app.ts"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || "localhost:9092"] })
const producer = kafka.producer()
await producer.connect()
logger.info("Kafka producer connected")

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL
const productFetcher = {
  fetchProduct: (productId: number) =>
    fetch(`${PRODUCT_SERVICE_URL}/products/${productId}`).then((r) => r.json()),
}

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error("JWT_SECRET env var is required")

const PORT = process.env.PORT || 3003
const app = createApp(prisma, producer, productFetcher, JWT_SECRET)

app.listen(PORT, () => {
  logger.info("order-service started", { port: PORT })
})
