import { jest } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp, OrderDb, KafkaProducer, ProductFetcher } from '../app.ts'

const JWT_SECRET = 'test-secret'
const adminToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET)
const customerToken = jwt.sign({ id: 2, username: 'alice', role: 'customer' }, JWT_SECRET)

const sampleOrder = {
  id: 1, userId: 2, total: 299.99, status: 'pending',
  createdAt: new Date(), items: [{ id: 1, orderId: 1, productId: 1, quantity: 1, price: 299.99 }],
}

function makeMockDb(overrides: Partial<OrderDb> = {}): OrderDb {
  return {
    order: {
      create: jest.fn<any>().mockResolvedValue(sampleOrder),
      findMany: jest.fn<any>().mockResolvedValue([sampleOrder]),
      findUnique: jest.fn<any>().mockResolvedValue(sampleOrder),
      update: jest.fn<any>().mockResolvedValue({ ...sampleOrder, status: 'confirmed' }),
    },
    $transaction: jest.fn<any>().mockImplementation((fn: any) => fn({ order: { create: jest.fn<any>().mockResolvedValue(sampleOrder) } })),
    ...overrides,
  }
}

const mockKafka: KafkaProducer = { send: jest.fn<any>().mockResolvedValue(undefined) }
const mockProductFetcher: ProductFetcher = {
  fetchProduct: jest.fn<any>().mockResolvedValue({ id: 1, name: 'Phone', price: '299.99' }),
}

// ── POST /orders ──────────────────────────────────────────────────────────────

describe('POST /orders', () => {
  it('places an order successfully', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId: 1, quantity: 1 }] })
    expect(res.status).toBe(201)
  })

  it('returns 400 for empty items array', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [] })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('items must be a non-empty array')
  })

  it('returns 400 when quantity exceeds 999', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId: 1, quantity: 1000 }] })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('quantity cannot exceed 999')
  })

  it('returns 400 when product does not exist', async () => {
    const fetcher: ProductFetcher = { fetchProduct: jest.fn<any>().mockResolvedValue({ error: 'Product not found' }) }
    const app = createApp(makeMockDb(), mockKafka, fetcher, JWT_SECRET)
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId: 999, quantity: 1 }] })
    expect(res.status).toBe(400)
  })

  it('returns 401 with no token', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app).post('/orders').send({ items: [{ productId: 1, quantity: 1 }] })
    expect(res.status).toBe(401)
  })
})

// ── GET /orders ───────────────────────────────────────────────────────────────

describe('GET /orders', () => {
  it('returns current user orders', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app).get('/orders').set('Authorization', `Bearer ${customerToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns 401 with no token', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app).get('/orders')
    expect(res.status).toBe(401)
  })
})

// ── GET /orders/all ───────────────────────────────────────────────────────────

describe('GET /orders/all', () => {
  it('returns all orders for admin', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app).get('/orders/all').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns 403 for non-admin', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app).get('/orders/all').set('Authorization', `Bearer ${customerToken}`)
    expect(res.status).toBe(403)
  })
})

// ── GET /orders/:id ───────────────────────────────────────────────────────────

describe('GET /orders/:id', () => {
  it('returns order when it belongs to the user', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app).get('/orders/1').set('Authorization', `Bearer ${customerToken}`)
    expect(res.status).toBe(200)
  })

  it('returns 403 when order belongs to another user', async () => {
    const db = makeMockDb()
    db.order.findUnique = jest.fn<any>().mockResolvedValue({ ...sampleOrder, userId: 999 })
    const app = createApp(db, mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app).get('/orders/1').set('Authorization', `Bearer ${customerToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 when order not found', async () => {
    const db = makeMockDb()
    db.order.findUnique = jest.fn<any>().mockResolvedValue(null)
    const app = createApp(db, mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app).get('/orders/999').set('Authorization', `Bearer ${customerToken}`)
    expect(res.status).toBe(404)
  })
})

// ── PUT /orders/:id/status ────────────────────────────────────────────────────

describe('PUT /orders/:id/status', () => {
  it('updates status (admin)', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app)
      .put('/orders/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('confirmed')
  })

  it('returns 400 for invalid status', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app)
      .put('/orders/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'refunded' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('status must be one of: pending, confirmed, shipped, delivered, cancelled')
  })

  it('returns 403 for non-admin', async () => {
    const app = createApp(makeMockDb(), mockKafka, mockProductFetcher, JWT_SECRET)
    const res = await request(app)
      .put('/orders/1/status')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'confirmed' })
    expect(res.status).toBe(403)
  })
})
