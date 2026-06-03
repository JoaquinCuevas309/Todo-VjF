import DOMPurify from 'dompurify'

/**
 * Sanitiza cadenas de texto eliminando HTML/scripts antes de enviar al backend.
 * Aunque FastAPI + Pydantic sanitizan en el servidor, aplicar una capa
 * en el cliente es defensa en profundidad contra payloads maliciosos
 * generados programáticamente.
 */
export function sanitizeText(raw: string): string {
  // Elimina todas las etiquetas HTML — solo texto plano
  return DOMPurify.sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim()
}

/** Normaliza un RUT chileno: elimina puntos, convierte guión y K a mayúscula. */
export function normalizeRut(raw: string): string {
  return raw
    .replace(/\./g, '')          // eliminar puntos (12.345.678-9 → 12345678-9)
    .replace(/\s/g, '')          // eliminar espacios
    .toUpperCase()               // K mayúscula
}
