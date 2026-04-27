import { CreateReviewSchema } from '../schemas.ts'

describe('CreateReviewSchema', () => {
  const valid = { productId: 1, rating: 4, comment: 'Great product!' }

  it('accepts valid review', () => {
    expect(CreateReviewSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts review without comment', () => {
    const { comment, ...rest } = valid
    expect(CreateReviewSchema.safeParse(rest).success).toBe(true)
  })

  it('rejects non-positive productId', () => {
    const r = CreateReviewSchema.safeParse({ ...valid, productId: 0 })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('productId must be a positive integer')
  })

  it('rejects rating below 1', () => {
    const r = CreateReviewSchema.safeParse({ ...valid, rating: 0 })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('rating must be at least 1')
  })

  it('rejects rating above 5', () => {
    const r = CreateReviewSchema.safeParse({ ...valid, rating: 6 })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('rating cannot exceed 5')
  })

  it('rejects comment longer than 1000 characters', () => {
    const r = CreateReviewSchema.safeParse({ ...valid, comment: 'x'.repeat(1001) })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('comment cannot exceed 1000 characters')
  })
})
