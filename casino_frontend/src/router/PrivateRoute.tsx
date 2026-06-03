/**
 * PrivateRoute — Guard de rutas con soporte de roles.
 *
 * Casos que maneja:
 *  1. Restaurando sesión (isLoading) → spinner, no redirige aún.
 *  2. Sin sesión → /login con `state.from` para redirigir al volver.
 *  3. Sesión activa pero rol insuficiente → /unauthorized.
 *  4. Todo OK → renderiza <Outlet />.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

interface PrivateRouteProps {
  /** Roles permitidos. Si se omite, cualquier usuario autenticado puede pasar. */
  allowedRoles?: UserRole[]
}

export default function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-ci-void flex items-center justify-center"
        aria-label="Cargando sesión"
        role="status"
      >
        <span className="w-5 h-5 border-2 border-ci-line border-t-ci-amber rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    )
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
