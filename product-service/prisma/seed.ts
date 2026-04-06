import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const products = [
  { name: "Laptop Pro 15",       description: "High-performance laptop",      price: 999.99,  stock: 50,  category: "Electronics" },
  { name: "Wireless Mouse",      description: "Ergonomic wireless mouse",      price: 29.99,   stock: 200, category: "Electronics" },
  { name: "Mechanical Keyboard", description: "RGB mechanical keyboard",       price: 79.99,   stock: 150, category: "Electronics" },
  { name: "4K Monitor",          description: "27-inch 4K UHD monitor",        price: 399.99,  stock: 75,  category: "Electronics" },
  { name: "USB-C Hub",           description: "7-in-1 USB-C hub",              price: 49.99,   stock: 300, category: "Electronics" },
  { name: "Running Shoes",       description: "Lightweight running shoes",     price: 89.99,   stock: 100, category: "Clothing"     },
  { name: "Backpack",            description: "Water-resistant laptop bag",    price: 59.99,   stock: 80,  category: "Accessories"  },
  { name: "Desk Lamp",           description: "LED desk lamp with USB port",   price: 34.99,   stock: 120, category: "Home"         },
  { name: "Coffee Maker",        description: "12-cup programmable maker",     price: 49.99,   stock: 60,  category: "Home"         },
  { name: "Notebook Set",        description: "Pack of 3 hardcover notebooks", price: 19.99,   stock: 500, category: "Stationery"   },
];

async function main() {
  const existing = await prisma.product.count();

  if (existing > 0) {
    console.log(`Skipping seed — ${existing} products already exist`);
    return;
  }

  await prisma.product.createMany({ data: products });
  console.log(`Seeded ${products.length} products`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
