import { jest } from '@jest/globals'
import request from 'supertest'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { createApp, UserDb } from '../app.ts'

const JWT_SECRET = 'test-secret'

// ── Mock DB ──────────────────────────────────────────────────────────────────
// We never touch a real database — these are plain objects Jest controls.

function makeMockDb(overrides: Partial<UserDb['user']> = {}): UserDb {
  return {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      ...overrides,
    },
  }
}

// ── POST /register ────────────────────────────────────────────────────────────

describe('POST /register', () => {
  it('returns 201 with token on valid input', async () => {
    const db = makeMockDb({
      create: jest.fn().mockResolvedValue({ id: 1, username: 'alice', email: 'alice@example.com', role: 'customer', createdAt: new Date() }),
    })
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).post('/register').send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'secret123',
    })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body.username).toBe('alice')
    expect(res.body.role).toBe('customer')
  })

  it('returns 400 when username is too short', async () => {
    const db = makeMockDb()
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).post('/register').send({
      username: 'ab',
      email: 'alice@example.com',
      password: 'secret123',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('username must be at least 3 characters')
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('returns 400 when email is invalid', async () => {
    const db = makeMockDb()
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).post('/register').send({
      username: 'alice',
      email: 'not-an-email',
      password: 'secret123',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid email address')
  })

  it('returns 400 when password is too short', async () => {
    const db = makeMockDb()
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).post('/register').send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'short',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('password must be at least 8 characters')
  })

  it('returns 409 when username/email already taken', async () => {
    const db = makeMockDb({
      create: jest.fn().mockRejectedValue({ code: 'P2002' }),
    })
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).post('/register').send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'secret123',
    })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('Username or email already taken')
  })
})

// ── POST /login ───────────────────────────────────────────────────────────────

describe('POST /login', () => {
  it('returns 200 with token on valid credentials', async () => {
    const hashed = await bcrypt.hash('secret123', 10)
    const db = makeMockDb({
      findUnique: jest.fn().mockResolvedValue({ id: 1, username: 'alice', email: 'alice@example.com', password: hashed, role: 'customer' }),
    })
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).post('/login').send({ email: 'alice@example.com', password: 'secret123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.username).toBe('alice')
  })

  it('returns 401 when user does not exist', async () => {
    const db = makeMockDb({ findUnique: jest.fn().mockResolvedValue(null) })
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).post('/login').send({ email: 'ghost@example.com', password: 'secret123' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid credentials')
  })

  it('returns 401 on wrong password', async () => {
    const hashed = await bcrypt.hash('correct-password', 10)
    const db = makeMockDb({
      findUnique: jest.fn().mockResolvedValue({ id: 1, username: 'alice', email: 'alice@example.com', password: hashed, role: 'customer' }),
    })
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).post('/login').send({ email: 'alice@example.com', password: 'wrong-password' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid credentials')
  })

  it('returns 400 when email is invalid', async () => {
    const db = makeMockDb()
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).post('/login').send({ email: 'bad', password: 'secret123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid email address')
  })
})

// ── GET /profile ──────────────────────────────────────────────────────────────

describe('GET /profile', () => {
  it('returns 200 with user data for valid token', async () => {
    const dbUser = { id: 1, username: 'alice', email: 'alice@example.com', role: 'customer', createdAt: new Date() }
    const db = makeMockDb({ findUnique: jest.fn().mockResolvedValue(dbUser) })
    const app = createApp(db, JWT_SECRET)
    const token = jwt.sign({ id: 1, username: 'alice', role: 'customer' }, JWT_SECRET)

    const res = await request(app).get('/profile').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.username).toBe('alice')
  })

  it('returns 401 with no token', async () => {
    const db = makeMockDb()
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).get('/profile')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('No token provided')
  })

  it('returns 401 with invalid token', async () => {
    const db = makeMockDb()
    const app = createApp(db, JWT_SECRET)

    const res = await request(app).get('/profile').set('Authorization', 'Bearer totally-fake-token')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid or expired token')
  })

  it('returns 404 when user no longer exists in DB', async () => {
    const db = makeMockDb({ findUnique: jest.fn().mockResolvedValue(null) })
    const app = createApp(db, JWT_SECRET)
    const token = jwt.sign({ id: 99, username: 'ghost', role: 'customer' }, JWT_SECRET)

    const res = await request(app).get('/profile').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('User not found')
  })
})
