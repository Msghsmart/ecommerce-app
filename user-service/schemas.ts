import { z } from 'zod'

export const RegisterSchema = z.object({
  username: z.string().min(3, 'username must be at least 3 characters').max(50),
  email: z.string().email('invalid email address'),
  password: z.string().min(8, 'password must be at least 8 characters').max(100),
})

export const LoginSchema = z.object({
  email: z.string().email('invalid email address'),
  password: z.string().min(1, 'password is required'),
})
