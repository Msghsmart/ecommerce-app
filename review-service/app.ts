import express, { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import logger from "./logger.ts"
import { CreateReviewSchema } from "./schemas.ts"

export interface ReviewDb {
  review: {
    create(args: any): Promise<any>
    findMany(args: any): Promise<any[]>
    findUnique(args: any): Promise<any>
    delete(args: any): Promise<any>
  }
}

export interface CacheClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: string, ttl: number): Promise<any>
  del(key: string): Promise<any>
}

export interface OrderFetcher {
  fetchOrders(token: string): Promise<{ items: { productId: number }[] }[]>
}

export function createApp(db: ReviewDb, cache: CacheClient, orderFetcher: OrderFetcher, jwtSecret: string) {
  const app = express()
  app.use(express.json())

  const CACHE_TTL = 60

  // ── Request logging ─────────────────────────────────────────────────────────

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()
    res.on("finish", () => {
      logger.info(`${req.method} ${req.path}`, {
        method: req.method, path: req.path,
        status: res.statusCode, duration: `${Date.now() - start}ms`,
      })
    })
    next()
  })

  // ── Auth middleware ──────────────────────────────────────────────────────────

  function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = req.headers["authorization"]?.split(" ")[1]
    if (!token) return res.status(401).json({ error: "No token provided" })
    try {
      ;(req as any).user = jwt.verify(token, jwtSecret)
      next()
    } catch {
      res.status(401).json({ error: "Invalid or expired token" })
    }
  }

  // ── Routes ───────────────────────────────────────────────────────────────────

  // POST /reviews
  app.post("/reviews", requireAuth, async (req, res) => {
    const result = CreateReviewSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message })
    const { productId, rating, comment } = result.data

    const token = req.headers["authorization"]!.split(" ")[1]
    const orders = await orderFetcher.fetchOrders(token)
    const hasOrdered = orders.some((o) => o.items.some((item) => item.productId === productId))

    if (!hasOrdered) {
      return res.status(403).json({ error: "You can only review products you have ordered" })
    }

    try {
      const review = await db.review.create({
        data: { userId: (req as any).user.id, username: (req as any).user.username, productId, rating, comment: comment || null },
      })
      logger.info("review created", { reviewId: review.id, productId, userId: review.userId })
      await cache.del(`reviews:product:${productId}`)
      res.status(201).json(review)
    } catch (err: any) {
      if (err.code === "P2002") {
        logger.warn("duplicate review attempt", { userId: (req as any).user.id, productId })
        return res.status(409).json({ error: "You have already reviewed this product" })
      }
      logger.error("create review error", { error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  // GET /reviews/product/:productId
  app.get("/reviews/product/:productId", async (req, res) => {
    const productId = parseInt(req.params.productId)
    const cacheKey = `reviews:product:${productId}`

    try {
      const cached = await cache.get(cacheKey)
      if (cached) {
        logger.info("cache hit", { key: cacheKey })
        return res.json(JSON.parse(cached))
      }
      logger.info("cache miss", { key: cacheKey })

      const reviews = await db.review.findMany({ where: { productId }, orderBy: { createdAt: "desc" } })
      const average = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null
      const response = { reviews, average, count: reviews.length }

      await cache.set(cacheKey, JSON.stringify(response), "EX", CACHE_TTL)
      res.json(response)
    } catch (err) {
      logger.error("get reviews error", { productId, error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  // DELETE /reviews/:id
  app.delete("/reviews/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id)

    try {
      const review = await db.review.findUnique({ where: { id } })
      if (!review) return res.status(404).json({ error: "Review not found" })

      if ((req as any).user.role !== "admin" && review.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Access denied" })
      }

      await db.review.delete({ where: { id } })
      logger.info("review deleted", { reviewId: id, userId: (req as any).user.id })
      await cache.del(`reviews:product:${review.productId}`)
      res.json({ message: "Review deleted" })
    } catch (err) {
      logger.error("delete review error", { id, error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  return app
}
