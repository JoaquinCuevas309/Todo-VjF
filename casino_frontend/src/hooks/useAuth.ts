import { useContext } from 'react'
import { AuthContext } from '@/context/AuthContext'
import type { UserRole } from '@/types/auth.types'

/** Hook principal para acceder al contexto de autenticación. */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}

/** Comprueba si el usuario tiene alguno de los roles indicados. */
export function useHasRole(...roles: UserRole[]): boolean {
  const { user } = useAuth()
  return Boolean(user && roles.includes(user.role))
}
