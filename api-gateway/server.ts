import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import Redis from "ioredis";

const app = express();
const redis = new Redis(process.env.REDIS_URL!);
const PORT = process.env.PORT || 3000;

const RATE_LIMIT_WINDOW = 60;  // seconds
const RATE_LIMIT_MAX = 100;    // requests per window

// ── Rate Limiting ─────────────────────────────────────────────────────────────

async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `ratelimit:${ip}`;

  // INCR returns the new count; if it's 1, this is the first request — set expiry
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW);
  }

  if (count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many requests. Try again in a minute." });
  }

  next();
}

app.use(rateLimiter);

// ── Proxies ───────────────────────────────────────────────────────────────────

app.use(
  createProxyMiddleware({
    pathFilter: "/api/users",
    target: process.env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/users": "" },
  }),
);

app.use(
  createProxyMiddleware({
    pathFilter: "/api/products",
    target: process.env.PRODUCT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/products": "/products" },
  }),
);

app.use(
  createProxyMiddleware({
    pathFilter: "/api/orders",
    target: process.env.ORDER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/orders": "/orders" },
  }),
);

app.use(
  createProxyMiddleware({
    pathFilter: "/api/reviews",
    target: process.env.REVIEW_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/reviews": "/reviews" },
  }),
);

// ── 404 for unmatched routes ──────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`api-gateway running on port ${PORT}`);
  console.log(`  /api/users    → ${process.env.USER_SERVICE_URL}`);
  console.log(`  /api/products → ${process.env.PRODUCT_SERVICE_URL}`);
  console.log(`  /api/orders   → ${process.env.ORDER_SERVICE_URL}`);
  console.log(`  /api/reviews  → ${process.env.REVIEW_SERVICE_URL}`);
});
