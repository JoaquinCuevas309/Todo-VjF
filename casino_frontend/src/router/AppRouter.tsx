import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

// ─── Carga diferida para reducir el bundle inicial ────────────────
const LoginPage       = lazy(() => import('@/modules/auth/LoginPage'))
const DashboardPage   = lazy(() => import('@/modules/reports/DashboardPage'))
const MenusPage       = lazy(() => import('@/modules/menus/MenusPage'))
const POSPage         = lazy(() => import('@/modules/pos/POSPage'))
const ReportsPage     = lazy(() => import('@/modules/reports/ReportsPage'))
const DinerApp        = lazy(() => import('@/features/diner/components/DinerApp'))

// ─── Página de acceso denegado (inline, sin lazy) ─────────────────
const UnauthorizedPage = () => (
  <div className="min-h-screen bg-ci-void flex flex-col items-center justify-center gap-4">
    <p className="font-mono text-xs text-ci-amber/50 tracking-widest uppercase">403</p>
    <h1 className="font-display font-black text-4xl text-ci-primary">Acceso Denegado</h1>
    <p className="text-ci-secondary text-sm">No tiene permisos para acceder a esta sección.</p>
    <a href="/dashboard" className="text-ci-amber text-sm font-mono hover:underline mt-2">
      ← Volver al inicio
    </a>
  </div>
)

// ─── Spinner de carga para Suspense ───────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen bg-ci-void flex items-center justify-center">
    <div className="w-5 h-5 border-2 border-ci-line border-t-ci-amber rounded-full animate-spin" />
  </div>
)

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Pública ──────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* ── Comensales (vista móvil PWA) ─────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['diner']} />}>
            <Route path="/mi-casino" element={<DinerApp />} />
          </Route>

          {/* ── Cualquier usuario autenticado ────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/menus"     element={<MenusPage />} />
          </Route>

          {/* ── Solo operators y admins (POS) ────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'operator']} />}>
            <Route path="/pos" element={<POSPage />} />
          </Route>

          {/* ── Solo admins (reportes) ────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          {/* Raíz → redirige según rol (manejado en AuthContext en producción) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
