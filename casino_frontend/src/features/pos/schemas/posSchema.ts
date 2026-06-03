import { z } from 'zod'
import DOMPurify from 'dompurify'

const clean  = (v: string) => DOMPurify.sanitize(v, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim()
const RUT_RE = /^\d{7,8}-[\dkK]$/
const QR_RE  = /^[a-zA-Z0-9\-_]{1,64}$/

export const PAYMENT_METHODS = ['balance', 'payroll_discount', 'cash', 'free'] as const

const paymentMethodField = z.enum(PAYMENT_METHODS, {
  errorMap: () => ({ message: 'Seleccione un método de pago' }),
})

// ── Schema para modo QR ───────────────────────────────────────────
export const qrSchema = z.object({
  qr_token: z
    .string()
    .min(1, 'Escanee o ingrese el token QR')
    .max(64, 'Token QR inválido: demasiado largo')
    .transform(clean)
    .refine((v) => QR_RE.test(v), 'El token QR contiene caracteres no permitidos'),
  payment_method: paymentMethodField,
})

// ── Schema para modo RUT ──────────────────────────────────────────
export const rutSchema = z.object({
  user_rut: z
    .string()
    .min(1, 'Ingrese el RUT del comensal')
    .transform((v) => clean(v.replace(/\./g, '').replace(/\s/g, '').toUpperCase()))
    .refine((v) => RUT_RE.test(v), 'RUT inválido. Formato correcto: 12345678-9'),
  payment_method: paymentMethodField,
})

export type QRFormData  = z.infer<typeof qrSchema>
export type RUTFormData = z.infer<typeof rutSchema>
