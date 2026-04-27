import { PlaceOrderSchema, UpdateStatusSchema } from '../schemas.ts'

describe('PlaceOrderSchema', () => {
  const valid = { items: [{ productId: 1, quantity: 2 }] }

  it('accepts valid order', () => {
    expect(PlaceOrderSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty items array', () => {
    const r = PlaceOrderSchema.safeParse({ items: [] })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('items must be a non-empty array')
  })

  it('rejects missing items', () => {
    expect(PlaceOrderSchema.safeParse({}).success).toBe(false)
  })

  it('rejects quantity of 0', () => {
    const r = PlaceOrderSchema.safeParse({ items: [{ productId: 1, quantity: 0 }] })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('quantity must be at least 1')
  })

  it('rejects quantity above 999', () => {
    const r = PlaceOrderSchema.safeParse({ items: [{ productId: 1, quantity: 1000 }] })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('quantity cannot exceed 999')
  })

  it('rejects non-positive productId', () => {
    const r = PlaceOrderSchema.safeParse({ items: [{ productId: 0, quantity: 1 }] })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('productId must be a positive integer')
  })

  it('accepts multiple items', () => {
    const r = PlaceOrderSchema.safeParse({ items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 5 }] })
    expect(r.success).toBe(true)
  })
})

describe('UpdateStatusSchema', () => {
  it.each(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])('accepts status "%s"', (status) => {
    expect(UpdateStatusSchema.safeParse({ status }).success).toBe(true)
  })

  it('rejects unknown status', () => {
    const r = UpdateStatusSchema.safeParse({ status: 'refunded' })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('status must be one of: pending, confirmed, shipped, delivered, cancelled')
  })

  it('rejects missing status', () => {
    expect(UpdateStatusSchema.safeParse({}).success).toBe(false)
  })
})
