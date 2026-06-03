import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SESSION_EXPIRED_EVENT } from '@/api/client'
import { tokenStore } from '@/api/tokenStore'
import { tokenToUser, isTokenExpired } from '@/utils/jwt'
import type { AuthContextValue, AuthUser } from '@/types/auth.types'

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── Restaurar sesión desde tokenStore al montar ────────────────
  useEffect(() => {
    const stored = tokenStore.get()
    if (stored && !isTokenExpired(stored)) {
      const parsed = tokenToUser(stored)
      if (parsed) {
        setToken(stored)
        setUser(parsed)
      } else {
        tokenStore.clear()
      }
    } else if (stored) {
      // Token expirado — limpia el storage
      tokenStore.clear()
    }
    setIsLoading(false)
  }, [])

  // ── Escuchar evento de sesión expirada (emitido por Axios) ─────
  useEffect(() => {
    const handleExpiry = () => {
      setToken(null)
      setUser(null)
      // El router redirigirá a /login via ProtectedRoute
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiry)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiry)
  }, [])

  const login = useCallback((newToken: string) => {
    const parsed = tokenToUser(newToken)
    if (!parsed) return
    tokenStore.set(newToken)
    setToken(newToken)
    setUser(parsed)
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
