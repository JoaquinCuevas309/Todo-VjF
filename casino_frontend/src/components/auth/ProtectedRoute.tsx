import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types/auth.types'

interface ProtectedRouteProps {
  /** Si se indica, solo los usuarios con alguno de estos roles pueden pasar. */
  allowedRoles?: UserRole[]
}

/**
 * Guard de rutas — protege contra:
 *
 * 1. Acceso sin autenticación → redirige a /login
 * 2. Acceso con rol insuficiente → redirige a /unauthorized
 *
 * Preserva la URL original en `state.from` para redirigir de vuelta
 * tras el login.
 */
export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  // Mientras se restaura la sesión desde storage, no redirigir aún
  if (isLoading) {
    return (
      <div className="min-h-screen bg-ci-void flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-ci-line border-t-ci-amber rounded-full animate-spin" />
      </div>
    )
  }

  // Sin sesión → login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Con sesión pero sin el rol requerido → página de acceso denegado
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
