import { z } from "zod"

export const CreateReviewSchema = z.object({
  productId: z.number().int().positive("productId must be a positive integer"),
  rating: z.number().int().min(1, "rating must be at least 1").max(5, "rating cannot exceed 5"),
  comment: z.string().max(1000, "comment cannot exceed 1000 characters").optional(),
})
