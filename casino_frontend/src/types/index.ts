// ── Roles (espejo exacto del enum PostgreSQL del backend) ─────────────
export type UserRole = 'admin' | 'operator' | 'diner'

// ── JWT payload decodificado (sin verificar firma — eso lo hace el backend) ──
export interface JwtPayload {
  sub: string      // UUID del usuario
  role: UserRole
  exp: number      // Unix timestamp de expiración
  iat: number      // Unix timestamp de emisión
  type: 'access'
}

// ── Usuario activo en sesión ──────────────────────────────────────────
export interface AuthUser {
  id: string
  role: UserRole
  expiresAt: Date
}

// ── Contexto de autenticación ─────────────────────────────────────────
export interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string) => void
  logout: () => void
}

// ── API: requests ─────────────────────────────────────────────────────
export interface LoginRequest {
  identifier: string   // RUT (12345678-9) o email
  password: string
}

// ── API: responses ────────────────────────────────────────────────────
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
