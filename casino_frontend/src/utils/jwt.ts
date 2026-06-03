import type { JwtPayload, AuthUser } from '@/types/auth.types'

/**
 * Decodifica el payload de un JWT SIN verificar la firma.
 * La verificación real la hace el backend — en el cliente
 * solo necesitamos leer los datos (role, expiry).
 */
export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Base64URL → Base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

/** Convierte un token JWT en un objeto AuthUser. */
export function tokenToUser(token: string): AuthUser | null {
  const payload = parseJwtPayload(token)
  if (!payload || payload.type !== 'access') return null
  return {
    id: payload.sub,
    role: payload.role,
    expiresAt: new Date(payload.exp * 1000),
  }
}

/** Comprueba si un token JWT ha expirado (con 30s de margen). */
export function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token)
  if (!payload) return true
  return Date.now() >= (payload.exp - 30) * 1000
}
