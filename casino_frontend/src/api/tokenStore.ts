/**
 * tokenStore — almacén de token de acceso JWT.
 *
 * ESTRATEGIA DE SEGURIDAD:
 * ─────────────────────────────────────────────────────────────────────
 * 1. Token en memoria (_accessToken): invisible para XSS porque el
 *    atacante necesita ejecutar JS en el mismo contexto React, no solo
 *    leer del DOM o del storage.
 *
 * 2. sessionStorage como caché de recarga: se pierde al cerrar la
 *    pestaña, no al refrescar la página. Menos seguro que la memoria
 *    pura, pero necesario hasta tener un endpoint /auth/refresh con
 *    cookie httpOnly en el backend.
 *
 * PRODUCCIÓN (recomendado): eliminar sessionStorage y usar el flujo
 * refresh-token con httpOnly + Secure + SameSite=Strict cookie.
 * ─────────────────────────────────────────────────────────────────────
 */

const STORAGE_KEY = '_cit'   // "casino institutional token" (nombre ofuscado)

let _accessToken: string | null = null

export const tokenStore = {
  /** Devuelve el token en memoria o lo restaura desde sessionStorage. */
  get(): string | null {
    return _accessToken ?? sessionStorage.getItem(STORAGE_KEY)
  },

  /** Almacena el token en memoria y como respaldo en sessionStorage. */
  set(token: string): void {
    _accessToken = token
    try {
      sessionStorage.setItem(STORAGE_KEY, token)
    } catch {
      // sessionStorage puede bloquearse en modo incógnito en algunos browsers
    }
  },

  /** Limpia el token de todos los almacenes. */
  clear(): void {
    _accessToken = null
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch { /* noop */ }
  },

  /** Indica si hay un token almacenado. */
  has(): boolean {
    return Boolean(this.get())
  },
}
