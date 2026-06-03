import { z } from 'zod'
import DOMPurify from 'dompurify'

// ── Expresiones regulares (espejo de los validadores del backend) ─────
const RUT_RE   = /^\d{7,8}-[\dkK]$/
const EMAIL_RE = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i

// ── Helpers de sanitización ───────────────────────────────────────────
const clean  = (v: string) => DOMPurify.sanitize(v, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim()
const rutFmt = (v: string) => v.replace(/\./g, '').replace(/\s/g, '').toUpperCase()

// ── Schema del formulario ─────────────────────────────────────────────
export const loginSchema = z.object({
  /**
   * Identificador: acepta RUT (12345678-9) o correo.
   * Se sanitiza con DOMPurify antes de validar el patrón.
   */
  identifier: z
    .string()
    .min(1, 'El identificador es requerido')
    .max(255, 'Identificador demasiado largo')
    .transform((v) => clean(rutFmt(v)))
    .refine(
      (v) => RUT_RE.test(v) || EMAIL_RE.test(v),
      'Ingrese un RUT válido (12345678-9) o un correo electrónico',
    ),

  /**
   * Contraseña: no se sanitiza con DOMPurify (nunca se renderiza en el DOM).
   * Tampoco se loguea ni se imprime en consola.
   */
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .max(200, 'Contraseña demasiado larga'),
})

export type LoginFormData = z.infer<typeof loginSchema>
