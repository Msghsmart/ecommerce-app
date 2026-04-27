import { jest } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp, ProductDb, CacheClient } from '../app.ts'

const JWT_SECRET = 'test-secret'
const adminToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET)
const customerToken = jwt.sign({ id: 2, username: 'alice', role: 'customer' }, JWT_SECRET)

const sampleProduct = { id: 1, name: 'Phone', description: null, price: 299.99, stock: 10, category: 'Electronics', createdAt: new Date() }

function makeMockDb(overrides: Partial<ProductDb['product']> = {}): ProductDb {
  return {
    product: {
      findMany: jest.fn<any>().mockResolvedValue([sampleProduct]),
      count: jest.fn<any>().mockResolvedValue(1),
      findUnique: jest.fn<any>().mockResolvedValue(sampleProduct),
      create: jest.fn<any>().mockResolvedValue(sampleProduct),
      update: jest.fn<any>().mockResolvedValue(sampleProduct),
      delete: jest.fn<any>().mockResolvedValue(sampleProduct),
      ...overrides,
    },
  }
}

function makeMockCache(overrides: Partial<CacheClient> = {}): CacheClient {
  return {
    get: jest.fn<any>().mockResolvedValue(null),
    set: jest.fn<any>().mockResolvedValue('OK'),
    del: jest.fn<any>().mockResolvedValue(1),
    keys: jest.fn<any>().mockResolvedValue([]),
    ...overrides,
  }
}

// ── GET /products ─────────────────────────────────────────────────────────────

describe('GET /products', () => {
  it('returns paginated products', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app).get('/products')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('pagination')
  })

  it('returns cached response on cache hit', async () => {
    const cached = JSON.stringify({ data: [sampleProduct], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } })
    const db = makeMockDb()
    const app = createApp(db, makeMockCache({ get: jest.fn<any>().mockResolvedValue(cached) }), JWT_SECRET)
    const res = await request(app).get('/products')
    expect(res.status).toBe(200)
    expect(db.product.findMany).not.toHaveBeenCalled()
  })

  it('rejects limit above 100', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app).get('/products?limit=500')
    expect(res.status).toBe(400)
  })
})

// ── GET /products/:id ─────────────────────────────────────────────────────────

describe('GET /products/:id', () => {
  it('returns a product by id', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app).get('/products/1')
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Phone')
  })

  it('returns 404 when product not found', async () => {
    const db = makeMockDb({ findUnique: jest.fn<any>().mockResolvedValue(null) })
    const app = createApp(db, makeMockCache(), JWT_SECRET)
    const res = await request(app).get('/products/999')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Product not found')
  })
})

// ── POST /products ────────────────────────────────────────────────────────────

describe('POST /products', () => {
  it('creates a product (admin)', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Phone', price: 299.99, stock: 10, category: 'Electronics' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Phone')
  })

  it('returns 403 for non-admin', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Phone', price: 299.99 })
    expect(res.status).toBe(403)
  })

  it('returns 401 with no token', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app).post('/products').send({ name: 'Phone', price: 299.99 })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 299.99 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '', price: 299.99 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('returns 400 when price is negative', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Phone', price: -5 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('price must be positive')
  })
})

// ── PUT /products/:id ─────────────────────────────────────────────────────────

describe('PUT /products/:id', () => {
  it('updates a product (admin)', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app)
      .put('/products/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 249.99 })
    expect(res.status).toBe(200)
  })

  it('returns 404 when product not found', async () => {
    const db = makeMockDb({ update: jest.fn<any>().mockRejectedValue({ code: 'P2025' }) })
    const app = createApp(db, makeMockCache(), JWT_SECRET)
    const res = await request(app)
      .put('/products/999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 249.99 })
    expect(res.status).toBe(404)
  })
})

// ── DELETE /products/:id ──────────────────────────────────────────────────────

describe('DELETE /products/:id', () => {
  it('deletes a product (admin)', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), JWT_SECRET)
    const res = await request(app)
      .delete('/products/1')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Product deleted')
  })

  it('returns 404 when product not found', async () => {
    const db = makeMockDb({ delete: jest.fn<any>().mockRejectedValue({ code: 'P2025' }) })
    const app = createApp(db, makeMockCache(), JWT_SECRET)
    const res = await request(app)
      .delete('/products/999')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})
