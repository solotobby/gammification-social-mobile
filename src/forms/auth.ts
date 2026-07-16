import { z } from 'zod';

/** Shared zod schemas for the auth forms (react-hook-form resolvers). */

export const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_.]+$/, 'Letters, numbers, dots and underscores only'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  referral_code: z.string().trim().optional(),
});

export type SignUpValues = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export type SignInValues = z.infer<typeof signInSchema>;
