import "dotenv/config";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3000;

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
