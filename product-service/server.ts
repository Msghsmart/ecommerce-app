import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";
import Redis from "ioredis";

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
const redis = new Redis(process.env.REDIS_URL!);
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET;
const CACHE_TTL = 60; // seconds

app.use(express.json());

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

// Deletes all cached product list pages
async function invalidateProductListCache() {
  const keys = await redis.keys("products:*");
  if (keys.length > 0) await redis.del(...keys);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /products  (public)
app.get("/products", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || "";
  const skip = (page - 1) * limit;

  const cacheKey = `products:${page}:${limit}:${search}`;

  try {
    // Cache-aside: check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    const result = {
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /products/:id  (public)
app.get("/products/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const cacheKey = `product:${id}`;

  try {
    // Cache-aside: check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await redis.set(cacheKey, JSON.stringify(product), "EX", CACHE_TTL);
    res.json(product);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /products  (admin only)
app.post("/products", requireAdmin, async (req, res) => {
  const { name, description, price, stock, category } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ error: "name and price are required" });
  }

  try {
    const product = await prisma.product.create({
      data: { name, description, price, stock, category },
    });

    await invalidateProductListCache();
    res.status(201).json(product);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /products/:id  (admin only)
app.put("/products/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, description, price, stock, category } = req.body;

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        price: price ?? undefined,
        stock: stock ?? undefined,
        category: category ?? undefined,
      },
    });

    await Promise.all([
      redis.del(`product:${id}`),
      invalidateProductListCache(),
    ]);
    res.json(product);
  } catch (err) {
    if ((err as any).code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /products/:id  (admin only)
app.delete("/products/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);

  try {
    await prisma.product.delete({ where: { id } });

    await Promise.all([
      redis.del(`product:${id}`),
      invalidateProductListCache(),
    ]);
    res.json({ message: "Product deleted" });
  } catch (err) {
    if ((err as any).code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`product-service running on port ${PORT}`);
});
