import { z } from 'zod'
import { sanitizeText, normalizeRut } from '@/utils/sanitize'

const RUT_RE    = /^\d{7,8}-[\dkK]$/
const EMAIL_RE  = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'El identificador es requerido')
    .max(255, 'Identificador demasiado largo')
    .transform((v) => sanitizeText(normalizeRut(v)))
    .refine(
      (v) => RUT_RE.test(v) || EMAIL_RE.test(v),
      'Ingrese un RUT válido (12345678-9) o un correo electrónico',
    ),

  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .max(200, 'Contraseña demasiado larga'),
    // No sanitizamos password con DOMPurify — no debe mostrarse en el DOM
})

export type LoginFormData = z.infer<typeof loginSchema>
