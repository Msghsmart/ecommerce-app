import express, { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import logger from "./logger.ts"
import { ProductsQuerySchema, CreateProductSchema, UpdateProductSchema } from "./schemas.ts"

export interface ProductDb {
  product: {
    findMany(args: any): Promise<any[]>
    count(args: any): Promise<number>
    findUnique(args: any): Promise<any>
    create(args: any): Promise<any>
    update(args: any): Promise<any>
    delete(args: any): Promise<any>
  }
}

export interface CacheClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: string, ttl: number): Promise<any>
  del(...keys: string[]): Promise<any>
  keys(pattern: string): Promise<string[]>
}

export function createApp(db: ProductDb, cache: CacheClient, jwtSecret: string) {
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

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    requireAuth(req, res, () => {
      if ((req as any).user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" })
      }
      next()
    })
  }

  async function invalidateProductListCache() {
    const keys = await cache.keys("products:*")
    if (keys.length > 0) await cache.del(...keys)
  }

  // ── Routes ───────────────────────────────────────────────────────────────────

  // GET /products
  app.get("/products", async (req, res) => {
    const result = ProductsQuerySchema.safeParse(req.query)
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message })
    const { page, limit, search } = result.data
    const skip = (page - 1) * limit
    const cacheKey = `products:${page}:${limit}:${search}`

    try {
      const cached = await cache.get(cacheKey)
      if (cached) {
        logger.info("cache hit", { key: cacheKey })
        return res.json(JSON.parse(cached))
      }
      logger.info("cache miss", { key: cacheKey })

      const where = search
        ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { category: { contains: search, mode: "insensitive" as const } }] }
        : {}

      const [products, total] = await Promise.all([
        db.product.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
        db.product.count({ where }),
      ])

      const response = { data: products, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } }
      await cache.set(cacheKey, JSON.stringify(response), "EX", CACHE_TTL)
      res.json(response)
    } catch (err) {
      logger.error("get products error", { error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  // GET /products/:id
  app.get("/products/:id", async (req, res) => {
    const id = parseInt(req.params.id)
    const cacheKey = `product:${id}`

    try {
      const cached = await cache.get(cacheKey)
      if (cached) {
        logger.info("cache hit", { key: cacheKey })
        return res.json(JSON.parse(cached))
      }
      logger.info("cache miss", { key: cacheKey })

      const product = await db.product.findUnique({ where: { id } })
      if (!product) return res.status(404).json({ error: "Product not found" })

      await cache.set(cacheKey, JSON.stringify(product), "EX", CACHE_TTL)
      res.json(product)
    } catch (err) {
      logger.error("get product error", { id, error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  // POST /products (admin)
  app.post("/products", requireAdmin, async (req, res) => {
    const result = CreateProductSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message })
    const { name, description, price, stock, category } = result.data

    try {
      const product = await db.product.create({ data: { name, description, price, stock, category } })
      logger.info("product created", { id: product.id, name: product.name })
      await invalidateProductListCache()
      res.status(201).json(product)
    } catch (err) {
      logger.error("create product error", { error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  // PUT /products/:id (admin)
  app.put("/products/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id)
    const result = UpdateProductSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message })
    const { name, description, price, stock, category } = result.data

    try {
      const product = await db.product.update({
        where: { id },
        data: { name, description, price, stock, category },
      })
      logger.info("product updated", { id })
      await Promise.all([cache.del(`product:${id}`), invalidateProductListCache()])
      res.json(product)
    } catch (err) {
      if ((err as any).code === "P2025") return res.status(404).json({ error: "Product not found" })
      logger.error("update product error", { id, error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  // DELETE /products/:id (admin)
  app.delete("/products/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id)

    try {
      await db.product.delete({ where: { id } })
      logger.info("product deleted", { id })
      await Promise.all([cache.del(`product:${id}`), invalidateProductListCache()])
      res.json({ message: "Product deleted" })
    } catch (err) {
      if ((err as any).code === "P2025") return res.status(404).json({ error: "Product not found" })
      logger.error("delete product error", { id, error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  return app
}
