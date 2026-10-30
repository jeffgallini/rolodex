import { contactTypes, workspaceRoles } from '@rolodex/db'
import { z } from 'zod'
import { AppError } from './errors'

const optionalText = (max: number) => z.string().max(max).nullish()

export const registerSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(120).optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
})

export const workspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

export const memberSchema = z.object({
  email: z.string().trim().email().max(200),
  role: z.enum(workspaceRoles),
})

export const memberRoleSchema = z.object({
  role: z.enum(workspaceRoles),
})

export const addressBookSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
})

export const tagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().max(20).nullish(),
})

const methodSchema = z.object({
  kind: z.enum(['email', 'phone', 'social', 'messaging']),
  label: z.string().max(40).nullish(),
  value: z.string().trim().min(1).max(500),
  isPrimary: z.boolean().optional(),
})

const addressSchema = z.object({
  label: z.string().max(40).nullish(),
  street: z.string().max(200).nullish(),
  street2: z.string().max(200).nullish(),
  city: z.string().max(120).nullish(),
  region: z.string().max(120).nullish(),
  postalCode: z.string().max(40).nullish(),
  country: z.string().max(120).nullish(),
})

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date')
  .nullish()

export const contactSchema = z.object({
  addressBookId: z.string().uuid().optional(),
  addressBookIds: z.array(z.string().uuid()).max(20).optional(),
  type: z.enum(contactTypes).optional(),
  prefix: optionalText(40),
  firstName: optionalText(120),
  middleName: optionalText(120),
  lastName: optionalText(120),
  suffix: optionalText(40),
  preferredName: optionalText(120),
  nickname: optionalText(120),
  organizationName: optionalText(200),
  department: optionalText(120),
  title: optionalText(120),
  position: optionalText(120),
  birthday: dateField,
  anniversary: dateField,
  website: optionalText(500),
  cardNote: optionalText(8000),
  howWeMet: optionalText(2000),
  introducedByContactId: z.string().uuid().nullish(),
  preferredCommunication: optionalText(80),
  interests: optionalText(4000),
  personalDetails: optionalText(8000),
  professionalBackground: optionalText(8000),
  followUpFrequency: optionalText(80),
  methods: z.array(methodSchema).max(30).optional(),
  addresses: z.array(addressSchema).max(10).optional(),
  tagIds: z.array(z.string().uuid()).max(50).optional(),
  tagNames: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
})

export const importSchema = z.object({
  vcf: z.string().min(1).max(5_000_000),
  commit: z.boolean().optional(),
  decisions: z
    .array(
      z.object({
        fingerprint: z.string().min(1).max(80),
        action: z.enum(['create', 'skip']),
      }),
    )
    .max(5000)
    .optional(),
})

export const appPasswordSchema = z.object({
  label: z.string().trim().min(1).max(80),
})

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(' ')
    throw new AppError(400, message || 'Invalid request')
  }
  return result.data
}
