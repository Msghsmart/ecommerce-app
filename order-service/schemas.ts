import { z } from "zod"

export const PlaceOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.number().int().positive("productId must be a positive integer"),
      quantity: z.number().int().min(1, "quantity must be at least 1").max(999, "quantity cannot exceed 999"),
    })
  ).min(1, "items must be a non-empty array"),
})

export const UpdateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"], {
    errorMap: () => ({ message: "status must be one of: pending, confirmed, shipped, delivered, cancelled" }),
  }),
})
