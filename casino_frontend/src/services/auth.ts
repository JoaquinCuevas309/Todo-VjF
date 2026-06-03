/**
 * services/auth.ts — Servicio de autenticación.
 *
 * Encapsula TODAS las llamadas al módulo /auth del backend.
 * Los componentes y hooks no importan `api` directamente —
 * solo consumen este servicio, lo que facilita el mockeo en tests.
 */

import api from '@/api/axios'
import type { LoginRequest, TokenResponse, UserOut } from '@/types'

export const authService = {
  /**
   * POST /auth/login
   *
   * El campo `operator_id` NO viene del cliente — el backend lo extrae
   * del JWT internamente. Esto es una decisión de seguridad del backend.
   *
   * @throws {ApiError} 401 → credenciales inválidas (mensaje genérico)
   * @throws {ApiError} 429 → cuenta bloqueada por intentos fallidos
   * @throws {ApiError} 422 → payload inválido (atrapado por Zod antes)
   */
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>('/auth/login', credentials)
    return data
  },

  /**
   * GET /auth/me
   * Devuelve el perfil del usuario autenticado (requiere token válido).
   */
  async me(): Promise<UserOut> {
    const { data } = await api.get<UserOut>('/auth/me')
    return data
  },

  /**
   * POST /auth/logout (futuro)
   * Cuando el backend implemente revocación de refresh tokens,
   * este método deberá llamar al endpoint correspondiente.
   *
   * Por ahora solo limpia el estado local — el token JWT expirará
   * por sí solo en el tiempo configurado (ACCESS_TOKEN_EXPIRE_MINUTES).
   */
  logout(): void {
    // TODO: cuando exista el endpoint → await api.post('/auth/logout')
    // El AuthContext llama a tokenStore.clear() antes de llamar a esto.
  },
}
