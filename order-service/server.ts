import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";
import { Kafka } from "kafkajs";
import logger from "./logger.ts";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL;

// ── Kafka producer ────────────────────────────────────────────────────────────

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || "localhost:9092"] });
const producer = kafka.producer();

await producer.connect();
logger.info("Kafka producer connected");

app.use(express.json());

// ── Request logging ───────────────────────────────────────────────────────────

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
    });
  });
  next();
});

// ── Middleware ────────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /orders  — place an order
app.post("/orders", requireAuth, async (req, res) => {
  const { items } = req.body;
  // items = [{ productId: 1, quantity: 2 }, ...]

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items must be a non-empty array" });
  }

  try {
    // Fetch each product from product-service to get current price
    const productRequests = items.map((item) =>
      fetch(`${PRODUCT_SERVICE_URL}/products/${item.productId}`).then((r) =>
        r.json(),
      ),
    );
    const products = await Promise.all(productRequests);

    // Check that all products exist
    for (const product of products) {
      if (product.error) {
        return res
          .status(400)
          .json({ error: `Product not found: ${product.error}` });
      }
    }

    // Calculate total
    const total = items.reduce((sum: number, item: any, index: number) => {
      return sum + parseFloat(products[index].price) * item.quantity;
    }, 0);

    // Create order + all items in a single transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: req.user.id,
          total,
          items: {
            create: items.map((item: any, index: number) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: parseFloat(products[index].price),
            })),
          },
        },
        include: { items: true },
      });

      return newOrder;
    });

    await producer.send({
      topic: "order.placed",
      messages: [{ value: JSON.stringify({ orderId: order.id, userId: order.userId, total: order.total }) }],
    });

    logger.info("order placed", { orderId: order.id, userId: order.userId, total: order.total });
    logger.info("Kafka event sent", { topic: "order.placed", orderId: order.id });

    res.status(201).json(order);
  } catch (err) {
    logger.error("place order error", { error: String(err) });
    res.status(500).json({ error: "Server error" });
  }
});

// GET /orders/all  — get all orders (admin only)
app.get("/orders/all", requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (err) {
    logger.error("get all orders error", { error: String(err) });
    res.status(500).json({ error: "Server error" });
  }
});

// GET /orders  — get my orders
app.get("/orders", requireAuth, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (err) {
    logger.error("get orders error", { error: String(err) });
    res.status(500).json({ error: "Server error" });
  }
});

// GET /orders/:id  — get a single order (must belong to the user)
app.get("/orders/:id", requireAuth, async (req, res) => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Customers can only see their own orders
    if (req.user.role !== "admin" && order.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(order);
  } catch (err) {
    logger.error("get order error", { id, error: String(err) });
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /orders/:id/status  — update order status (admin only)
app.put("/orders/:id/status", requireAdmin, async (req, res) => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const { status } = req.body;

  const validStatuses = [
    "pending",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled",
  ];

  if (!status || !validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ error: `status must be one of: ${validStatuses.join(", ")}` });
  }

  try {
    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });

    logger.info("order status updated", { orderId: id, status });
    res.json(order);
  } catch (err) {
    if ((err as any).code === "P2025") {
      return res.status(404).json({ error: "Order not found" });
    }
    logger.error("update order status error", { id, error: String(err) });
    res.status(500).json({ error: "Server error" });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info("order-service started", { port: PORT });
});
