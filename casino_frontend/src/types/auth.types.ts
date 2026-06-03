// ─── Payloads JWT ──────────────────────────────────────────────────
export interface JwtPayload {
  sub: string       // UUID del usuario
  role: UserRole
  exp: number       // Unix timestamp
  iat: number
  type: 'access'
}

// ─── Roles (espejo del backend) ────────────────────────────────────
export type UserRole = 'admin' | 'operator' | 'diner'

// ─── Usuario autenticado en cliente ────────────────────────────────
export interface AuthUser {
  id: string
  role: UserRole
  expiresAt: Date
}

// ─── Requests ──────────────────────────────────────────────────────
export interface LoginRequest {
  identifier: string   // RUT o email
  password: string
}

// ─── Responses ─────────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number   // segundos
}

export interface UserOut {
  id: string
  rut: string
  email: string | null
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

// ─── Estado del contexto de autenticación ──────────────────────────
export interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string) => void
  logout: () => void
}
