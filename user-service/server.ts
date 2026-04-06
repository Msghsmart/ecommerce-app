import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.ts'

declare global {
  namespace Express {
    interface Request {
      user?: any
    }
  }
}

const app = express()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET

app.use(express.json())

// ── Middleware ────────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /register
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { username, email, password: hashedPassword },
    })

    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    )

    res.status(201).json({ token, id: user.id, username: user.username, role: user.role })
  } catch (err) {
    if ((err as any).code === 'P2002') {
      // Prisma unique constraint violation
      return res.status(409).json({ error: 'Username or email already taken' })
    }
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /login
app.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const match = await bcrypt.compare(password, user.password)

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    )

    res.json({ token, id: user.id, username: user.username, role: user.role })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /profile  (protected)
app.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(user)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`user-service running on port ${PORT}`)
})
