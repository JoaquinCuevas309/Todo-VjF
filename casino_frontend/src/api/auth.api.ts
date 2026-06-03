import apiClient from './client'
import type { LoginRequest, TokenResponse, UserOut } from '@/types/auth.types'

export const authApi = {
  /**
   * POST /auth/login
   * Devuelve el access token JWT.
   * El operador_id nunca viene del cliente — lo pone el backend.
   */
  login(body: LoginRequest): Promise<TokenResponse> {
    return apiClient
      .post<TokenResponse>('/auth/login', body)
      .then((r) => r.data)
  },

  /** GET /auth/me — perfil del usuario autenticado */
  me(): Promise<UserOut> {
    return apiClient.get<UserOut>('/auth/me').then((r) => r.data)
  },
}
