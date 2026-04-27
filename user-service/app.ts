import express, { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import logger from './logger.ts'
import { RegisterSchema, LoginSchema } from './schemas.ts'

// Minimal interface — tests pass a mock, production passes real PrismaClient
export interface UserDb {
  user: {
    create(args: { data: { username: string; email: string; password: string } }): Promise<{
      id: number; username: string; email: string; role: string; createdAt: Date
    }>
    findUnique(args: { where: { email?: string; id?: number }; select?: any }): Promise<any>
  }
}

export function createApp(db: UserDb, jwtSecret: string) {
  const app = express()
  app.use(express.json())

  // ── Request logging ─────────────────────────────────────────────────────────

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()
    res.on('finish', () => {
      logger.info(`${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${Date.now() - start}ms`,
      })
    })
    next()
  })

  // ── Middleware ───────────────────────────────────────────────────────────────

  function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = req.headers['authorization']?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'No token provided' })
    try {
      ;(req as any).user = jwt.verify(token, jwtSecret)
      next()
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' })
    }
  }

  // ── Routes ───────────────────────────────────────────────────────────────────

  // POST /register
  app.post('/register', async (req, res) => {
    const result = RegisterSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message })
    }
    const { username, email, password } = result.data

    try {
      const hashedPassword = await bcrypt.hash(password, 10)
      const user = await db.user.create({ data: { username, email, password: hashedPassword } })
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret, { expiresIn: '1d' })
      logger.info('user registered', { userId: user.id, username })
      res.status(201).json({ token, id: user.id, username: user.username, role: user.role })
    } catch (err) {
      if ((err as any).code === 'P2002') {
        logger.warn('registration failed - duplicate', { username, email })
        return res.status(409).json({ error: 'Username or email already taken' })
      }
      logger.error('register error', { error: String(err) })
      res.status(500).json({ error: 'Server error' })
    }
  })

  // POST /login
  app.post('/login', async (req, res) => {
    const result = LoginSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message })
    }
    const { email, password } = result.data

    try {
      const user = await db.user.findUnique({ where: { email } })
      if (!user) {
        logger.warn('failed login attempt', { email })
        return res.status(401).json({ error: 'Invalid credentials' })
      }
      const match = await bcrypt.compare(password, user.password)
      if (!match) {
        logger.warn('failed login attempt', { email })
        return res.status(401).json({ error: 'Invalid credentials' })
      }
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret, { expiresIn: '1d' })
      logger.info('user logged in', { userId: user.id, username: user.username })
      res.json({ token, id: user.id, username: user.username, role: user.role })
    } catch (err) {
      logger.error('login error', { error: String(err) })
      res.status(500).json({ error: 'Server error' })
    }
  })

  // GET /profile (protected)
  app.get('/profile', requireAuth, async (req, res) => {
    try {
      const user = await db.user.findUnique({
        where: { id: (req as any).user.id },
        select: { id: true, username: true, email: true, role: true, createdAt: true },
      })
      if (!user) return res.status(404).json({ error: 'User not found' })
      res.json(user)
    } catch (err) {
      logger.error('profile error', { error: String(err) })
      res.status(500).json({ error: 'Server error' })
    }
  })

  return app
}
