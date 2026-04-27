import express, { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import logger from "./logger.ts"
import { PlaceOrderSchema, UpdateStatusSchema } from "./schemas.ts"

export interface OrderDb {
  order: {
    create(args: any): Promise<any>
    findMany(args: any): Promise<any[]>
    findUnique(args: any): Promise<any>
    update(args: any): Promise<any>
  }
  $transaction(fn: (tx: any) => Promise<any>): Promise<any>
}

export interface KafkaProducer {
  send(args: { topic: string; messages: { value: string }[] }): Promise<void>
}

export interface ProductFetcher {
  fetchProduct(productId: number): Promise<{ error?: string; price: string; [key: string]: any }>
}

export function createApp(
  db: OrderDb,
  kafka: KafkaProducer,
  productFetcher: ProductFetcher,
  jwtSecret: string
) {
  const app = express()
  app.use(express.json())

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

  // ── Routes ───────────────────────────────────────────────────────────────────

  // POST /orders
  app.post("/orders", requireAuth, async (req, res) => {
    const result = PlaceOrderSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message })
    const { items } = result.data

    try {
      const products = await Promise.all(items.map((item) => productFetcher.fetchProduct(item.productId)))

      for (const product of products) {
        if (product.error) return res.status(400).json({ error: `Product not found: ${product.error}` })
      }

      const total = items.reduce((sum, item, i) => sum + parseFloat(products[i].price) * item.quantity, 0)

      const order = await db.$transaction(async (tx: any) =>
        tx.order.create({
          data: {
            userId: (req as any).user.id,
            total,
            items: {
              create: items.map((item, i) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: parseFloat(products[i].price),
              })),
            },
          },
          include: { items: true },
        })
      )

      await kafka.send({ topic: "order.placed", messages: [{ value: JSON.stringify({ orderId: order.id, userId: order.userId, total: order.total }) }] })
      logger.info("order placed", { orderId: order.id, userId: order.userId, total: order.total })

      res.status(201).json(order)
    } catch (err) {
      logger.error("place order error", { error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  // GET /orders/all (admin)
  app.get("/orders/all", requireAdmin, async (req, res) => {
    try {
      const orders = await db.order.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } })
      res.json(orders)
    } catch (err) {
      logger.error("get all orders error", { error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  // GET /orders
  app.get("/orders", requireAuth, async (req, res) => {
    try {
      const orders = await db.order.findMany({
        where: { userId: (req as any).user.id },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      })
      res.json(orders)
    } catch (err) {
      logger.error("get orders error", { error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  // GET /orders/:id
  app.get("/orders/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id)

    try {
      const order = await db.order.findUnique({ where: { id }, include: { items: true } })
      if (!order) return res.status(404).json({ error: "Order not found" })

      if ((req as any).user.role !== "admin" && order.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Access denied" })
      }

      res.json(order)
    } catch (err) {
      logger.error("get order error", { id, error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  // PUT /orders/:id/status (admin)
  app.put("/orders/:id/status", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id)
    const result = UpdateStatusSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message })
    const { status } = result.data

    try {
      const order = await db.order.update({ where: { id }, data: { status }, include: { items: true } })
      logger.info("order status updated", { orderId: id, status })
      res.json(order)
    } catch (err) {
      if ((err as any).code === "P2025") return res.status(404).json({ error: "Order not found" })
      logger.error("update order status error", { id, error: String(err) })
      res.status(500).json({ error: "Server error" })
    }
  })

  return app
}
