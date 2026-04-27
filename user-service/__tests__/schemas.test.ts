import { RegisterSchema, LoginSchema } from '../schemas.ts'

describe('RegisterSchema', () => {
  const valid = { username: 'alice', email: 'alice@example.com', password: 'secret123' }

  it('accepts valid input', () => {
    expect(RegisterSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects username shorter than 3 characters', () => {
    const result = RegisterSchema.safeParse({ ...valid, username: 'ab' })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0].message).toBe('username must be at least 3 characters')
  })

  it('rejects invalid email', () => {
    const result = RegisterSchema.safeParse({ ...valid, email: 'not-an-email' })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0].message).toBe('invalid email address')
  })

  it('rejects password shorter than 8 characters', () => {
    const result = RegisterSchema.safeParse({ ...valid, password: 'short' })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0].message).toBe('password must be at least 8 characters')
  })

  it('rejects missing fields', () => {
    expect(RegisterSchema.safeParse({}).success).toBe(false)
  })
})

describe('LoginSchema', () => {
  const valid = { email: 'alice@example.com', password: 'secret123' }

  it('accepts valid input', () => {
    expect(LoginSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = LoginSchema.safeParse({ ...valid, email: 'bad' })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0].message).toBe('invalid email address')
  })

  it('rejects empty password', () => {
    const result = LoginSchema.safeParse({ ...valid, password: '' })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0].message).toBe('password is required')
  })
})
