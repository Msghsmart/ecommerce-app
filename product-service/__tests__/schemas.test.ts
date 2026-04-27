import { ProductsQuerySchema, CreateProductSchema, UpdateProductSchema } from '../schemas.ts'

describe('ProductsQuerySchema', () => {
  it('accepts valid query params', () => {
    expect(ProductsQuerySchema.safeParse({ page: '2', limit: '5', search: 'phone' }).success).toBe(true)
  })

  it('coerces page and limit from strings to numbers', () => {
    const r = ProductsQuerySchema.safeParse({ page: '3', limit: '20' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.page).toBe(3)
      expect(r.data.limit).toBe(20)
    }
  })

  it('applies defaults when fields are missing', () => {
    const r = ProductsQuerySchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.page).toBe(1)
      expect(r.data.limit).toBe(10)
      expect(r.data.search).toBe('')
    }
  })

  it('rejects limit above 100', () => {
    const r = ProductsQuerySchema.safeParse({ limit: '200' })
    expect(r.success).toBe(false)
  })

  it('rejects search longer than 100 characters', () => {
    const r = ProductsQuerySchema.safeParse({ search: 'a'.repeat(101) })
    expect(r.success).toBe(false)
  })
})

describe('CreateProductSchema', () => {
  const valid = { name: 'Phone', price: 299.99, stock: 10, category: 'Electronics' }

  it('accepts valid product', () => {
    expect(CreateProductSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty name', () => {
    const r = CreateProductSchema.safeParse({ ...valid, name: '' })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('name is required')
  })

  it('rejects negative price', () => {
    const r = CreateProductSchema.safeParse({ ...valid, price: -5 })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('price must be positive')
  })

  it('rejects negative stock', () => {
    const r = CreateProductSchema.safeParse({ ...valid, stock: -1 })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('stock cannot be negative')
  })

  it('rejects missing price', () => {
    const { price, ...rest } = valid
    expect(CreateProductSchema.safeParse(rest).success).toBe(false)
  })
})

describe('UpdateProductSchema', () => {
  it('accepts a partial update', () => {
    expect(UpdateProductSchema.safeParse({ price: 199.99 }).success).toBe(true)
  })

  it('accepts empty object (no-op update)', () => {
    expect(UpdateProductSchema.safeParse({}).success).toBe(true)
  })

  it('still rejects invalid values', () => {
    const r = UpdateProductSchema.safeParse({ price: -10 })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toBe('price must be positive')
  })
})
