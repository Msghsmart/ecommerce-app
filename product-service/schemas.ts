import { z } from "zod"

export const ProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(100).default(""),
})

export const CreateProductSchema = z.object({
  name: z.string().min(1, "name is required").max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive("price must be positive"),
  stock: z.number().int().min(0, "stock cannot be negative").default(0),
  category: z.string().max(100).optional(),
})

export const UpdateProductSchema = CreateProductSchema.partial()
