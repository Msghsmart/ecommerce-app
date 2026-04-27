import { jest } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp, ReviewDb, CacheClient, OrderFetcher } from '../app.ts'

const JWT_SECRET = 'test-secret'
const customerToken = jwt.sign({ id: 2, username: 'alice', role: 'customer' }, JWT_SECRET)
const adminToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET)

const sampleReview = { id: 1, userId: 2, username: 'alice', productId: 1, rating: 4, comment: 'Great!', createdAt: new Date() }

function makeMockDb(overrides: Partial<ReviewDb['review']> = {}): ReviewDb {
  return {
    review: {
      create: jest.fn<any>().mockResolvedValue(sampleReview),
      findMany: jest.fn<any>().mockResolvedValue([sampleReview]),
      findUnique: jest.fn<any>().mockResolvedValue(sampleReview),
      delete: jest.fn<any>().mockResolvedValue(sampleReview),
      ...overrides,
    },
  }
}

function makeMockCache(overrides: Partial<CacheClient> = {}): CacheClient {
  return {
    get: jest.fn<any>().mockResolvedValue(null),
    set: jest.fn<any>().mockResolvedValue('OK'),
    del: jest.fn<any>().mockResolvedValue(1),
    ...overrides,
  }
}

// orderFetcher that says user HAS ordered product 1
const mockOrderFetcher: OrderFetcher = {
  fetchOrders: jest.fn<any>().mockResolvedValue([{ items: [{ productId: 1 }] }]),
}

// orderFetcher that says user has NOT ordered anything
const noOrdersFetcher: OrderFetcher = {
  fetchOrders: jest.fn<any>().mockResolvedValue([]),
}

// ── POST /reviews ─────────────────────────────────────────────────────────────

describe('POST /reviews', () => {
  it('creates a review when user has ordered the product', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), mockOrderFetcher, JWT_SECRET)
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 1, rating: 4, comment: 'Great!' })
    expect(res.status).toBe(201)
    expect(res.body.rating).toBe(4)
  })

  it('returns 403 when user has not ordered the product', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), noOrdersFetcher, JWT_SECRET)
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 1, rating: 4 })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('You can only review products you have ordered')
  })

  it('returns 400 when rating is above 5', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), mockOrderFetcher, JWT_SECRET)
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 1, rating: 6 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('rating cannot exceed 5')
  })

  it('returns 400 when rating is below 1', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), mockOrderFetcher, JWT_SECRET)
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 1, rating: 0 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('rating must be at least 1')
  })

  it('returns 409 when user already reviewed the product', async () => {
    const db = makeMockDb({ create: jest.fn<any>().mockRejectedValue({ code: 'P2002' }) })
    const app = createApp(db, makeMockCache(), mockOrderFetcher, JWT_SECRET)
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 1, rating: 4 })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('You have already reviewed this product')
  })

  it('returns 401 with no token', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), mockOrderFetcher, JWT_SECRET)
    const res = await request(app).post('/reviews').send({ productId: 1, rating: 4 })
    expect(res.status).toBe(401)
  })
})

// ── GET /reviews/product/:productId ──────────────────────────────────────────

describe('GET /reviews/product/:productId', () => {
  it('returns reviews and average rating', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), mockOrderFetcher, JWT_SECRET)
    const res = await request(app).get('/reviews/product/1')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('reviews')
    expect(res.body).toHaveProperty('average')
    expect(res.body).toHaveProperty('count')
  })

  it('returns cached response on cache hit', async () => {
    const cached = JSON.stringify({ reviews: [sampleReview], average: 4, count: 1 })
    const db = makeMockDb()
    const app = createApp(db, makeMockCache({ get: jest.fn<any>().mockResolvedValue(cached) }), mockOrderFetcher, JWT_SECRET)
    const res = await request(app).get('/reviews/product/1')
    expect(res.status).toBe(200)
    expect(db.review.findMany).not.toHaveBeenCalled()
  })
})

// ── DELETE /reviews/:id ───────────────────────────────────────────────────────

describe('DELETE /reviews/:id', () => {
  it('allows owner to delete their review', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), mockOrderFetcher, JWT_SECRET)
    const res = await request(app).delete('/reviews/1').set('Authorization', `Bearer ${customerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Review deleted')
  })

  it('allows admin to delete any review', async () => {
    const app = createApp(makeMockDb(), makeMockCache(), mockOrderFetcher, JWT_SECRET)
    const res = await request(app).delete('/reviews/1').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('returns 403 when user tries to delete another user\'s review', async () => {
    const db = makeMockDb({ findUnique: jest.fn<any>().mockResolvedValue({ ...sampleReview, userId: 999 }) })
    const app = createApp(db, makeMockCache(), mockOrderFetcher, JWT_SECRET)
    const res = await request(app).delete('/reviews/1').set('Authorization', `Bearer ${customerToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 when review not found', async () => {
    const db = makeMockDb({ findUnique: jest.fn<any>().mockResolvedValue(null) })
    const app = createApp(db, makeMockCache(), mockOrderFetcher, JWT_SECRET)
    const res = await request(app).delete('/reviews/999').set('Authorization', `Bearer ${customerToken}`)
    expect(res.status).toBe(404)
  })
})
