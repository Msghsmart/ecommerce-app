import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

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
const PORT = process.env.PORT || 3004;
const JWT_SECRET = process.env.JWT_SECRET;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL;

app.use(express.json());

// ── Middleware ────────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  if (!JWT_SECRET) return res.status(500).json({ error: "Server configuration error" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /reviews — submit a review (must have ordered the product)
app.post("/reviews", requireAuth, async (req, res) => {
  const { productId, rating, comment } = req.body;

  if (!productId || !rating) {
    return res.status(400).json({ error: "productId and rating are required" });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: "rating must be between 1 and 5" });
  }

  // Check if user has ordered this product by calling order-service
  const token = req.headers["authorization"]?.split(" ")[1];
  const ordersRes = await fetch(`${ORDER_SERVICE_URL}/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const orders = await ordersRes.json();

  const hasOrdered = orders.some((order: any) =>
    order.items.some((item: any) => item.productId === productId)
  );

  if (!hasOrdered) {
    return res.status(403).json({ error: "You can only review products you have ordered" });
  }

  try {
    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        username: req.user.username,
        productId,
        rating,
        comment: comment || null,
      },
    });
    res.status(201).json(review);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "You have already reviewed this product" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// GET /reviews/product/:productId — get all reviews + average rating for a product
app.get("/reviews/product/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId);

  try {
    const reviews = await prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });

    const average =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    res.json({ reviews, average, count: reviews.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /reviews/:id — delete own review or admin
app.delete("/reviews/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return res.status(404).json({ error: "Review not found" });

    if (req.user.role !== "admin" && review.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    await prisma.review.delete({ where: { id } });
    res.json({ message: "Review deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`review-service running on port ${PORT}`);
});
