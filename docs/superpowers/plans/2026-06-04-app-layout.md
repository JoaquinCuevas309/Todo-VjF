# AppLayout + Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el layout de navegación (Header + Sidebar colapsable) que envuelve todas las rutas protegidas de admin/operator.

**Architecture:** 4 componentes nuevos bajo `src/components/layout/`. `AppLayout` usa `<Outlet />` de react-router-dom. El sidebar filtra nav items por rol usando `useAuth()`. Se integra en `AppRouter.tsx` anidando las rutas protegidas bajo `<AppLayout />`.

**Tech Stack:** React 18, TypeScript, react-router-dom v6, Tailwind CSS con tokens `ci-*`

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/components/layout/NavItem.tsx` | Crear | Ítem de navegación con estado activo y modo colapsado |
| `src/components/layout/AppHeader.tsx` | Crear | Barra superior con logo, nombre y estado online |
| `src/components/layout/Sidebar.tsx` | Crear | Panel lateral con nav items filtrados por rol + usuario |
| `src/components/layout/AppLayout.tsx` | Crear | Contenedor principal que combina header + sidebar + outlet |
| `src/router/AppRouter.tsx` | Modificar | Anidar rutas protegidas bajo `<AppLayout />` |

---

## Task 1: NavItem.tsx

**Files:**
- Create: `casino_frontend/src/components/layout/NavItem.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// casino_frontend/src/components/layout/NavItem.tsx
import { NavLink } from 'react-router-dom'

interface NavItemProps {
  to: string
  icon: string
  label: string
  collapsed: boolean
}

export default function NavItem({ to, icon, label, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-2 py-2 rounded-r-sm text-xs font-mono transition-colors duration-150',
          'border-l-2',
          isActive
            ? 'border-ci-amber bg-ci-amber/10 text-ci-amber'
            : 'border-transparent text-ci-secondary hover:text-ci-primary hover:bg-ci-overlay',
          collapsed ? 'justify-center px-0' : '',
        ].join(' ')
      }
    >
      <span className="text-base leading-none shrink-0">{icon}</span>
      {!collapsed && (
        <span className="truncate tracking-wide uppercase text-[10px]">
          {label}
        </span>
      )}
    </NavLink>
  )
}
```

- [ ] **Step 2: Verificar que no hay errores TypeScript**

```bash
cd casino_frontend && npx tsc --noEmit --skipLibCheck 2>&1 | grep "NavItem"
```
Esperado: sin output (sin errores en NavItem).

- [ ] **Step 3: Commit**

```bash
git add casino_frontend/src/components/layout/NavItem.tsx
git commit -m "feat: add NavItem component with active state and collapsed mode"
```

---

## Task 2: AppHeader.tsx

**Files:**
- Create: `casino_frontend/src/components/layout/AppHeader.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// casino_frontend/src/components/layout/AppHeader.tsx

interface AppHeaderProps {
  sidebarCollapsed: boolean
}

export default function AppHeader({ sidebarCollapsed }: AppHeaderProps) {
  return (
    <header className="h-10 bg-ci-base border-b border-ci-line flex items-center justify-between px-4 shrink-0 z-10">
      {/* Logo + nombre */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 border border-ci-amber flex items-center justify-center shrink-0">
          <span className="font-display font-black text-ci-amber text-xs tracking-widest">
            CI
          </span>
        </div>
        {!sidebarCollapsed && (
          <span className="font-mono text-[9px] tracking-[3px] text-ci-secondary uppercase hidden sm:block">
            Casino Institucional
          </span>
        )}
      </div>

      {/* Estado online + versión */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-ci-success shrink-0" />
        <span className="font-mono text-[9px] text-ci-secondary hidden sm:block">
          Sistema en línea
        </span>
        <span className="font-mono text-[9px] text-ci-muted ml-2">V1.0.0</span>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/components/layout/AppHeader.tsx
git commit -m "feat: add AppHeader with logo and online status indicator"
```

---

## Task 3: Sidebar.tsx

**Files:**
- Create: `casino_frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// casino_frontend/src/components/layout/Sidebar.tsx
import { useAuth } from '@/hooks/useAuth'
import NavItem from './NavItem'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

// Definición de todos los nav items con sus roles permitidos
const NAV_ITEMS = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard',  roles: ['admin', 'operator'] },
  { to: '/menus',     icon: '🍽',  label: 'Menús',      roles: ['admin', 'operator'] },
  { to: '/pos',       icon: '💳', label: 'POS',         roles: ['admin', 'operator'] },
  { to: '/reports',   icon: '📈', label: 'Reportes',    roles: ['admin'] },
] as const

const ROLE_LABEL: Record<string, string> = {
  admin:    'Administrador',
  operator: 'Operador',
  diner:    'Comensal',
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth()

  const visibleItems = NAV_ITEMS.filter(
    item => user && (item.roles as readonly string[]).includes(user.role)
  )

  const initial = user?.role?.[0]?.toUpperCase() ?? '?'
  const roleLabel = user ? (ROLE_LABEL[user.role] ?? user.role) : ''

  return (
    <aside
      className={[
        'flex flex-col bg-ci-base border-r border-ci-line shrink-0',
        'transition-all duration-300',
        collapsed ? 'w-10' : 'w-36',
      ].join(' ')}
    >
      {/* Toggle button */}
      <div className={['flex py-2 px-1', collapsed ? 'justify-center' : 'justify-end'].join(' ')}>
        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="w-6 h-6 flex items-center justify-center border border-ci-line rounded-sm text-ci-muted hover:text-ci-amber hover:border-ci-amber/40 transition-colors font-mono text-xs"
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-1 flex-1">
        {visibleItems.map(item => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-ci-line px-1 py-2 flex flex-col gap-1">
        {/* Avatar + role */}
        <div className={['flex items-center gap-2 px-1 py-1', collapsed ? 'justify-center' : ''].join(' ')}>
          <div className="w-5 h-5 rounded-full bg-ci-amber/15 border border-ci-amber/40 flex items-center justify-center shrink-0">
            <span className="font-mono text-ci-amber text-[9px] font-bold">{initial}</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-ci-primary font-mono text-[10px] truncate capitalize">{user?.role}</p>
              <p className="text-ci-muted font-mono text-[8px] tracking-widest uppercase truncate">{roleLabel}</p>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Cerrar sesión"
          className={[
            'flex items-center gap-2 px-2 py-1.5 rounded-sm text-ci-secondary hover:text-ci-error',
            'hover:bg-ci-error/5 transition-colors font-mono text-[10px] uppercase tracking-wide',
            collapsed ? 'justify-center' : '',
          ].join(' ')}
        >
          <span className="text-sm leading-none">⎋</span>
          {!collapsed && <span>Salir</span>}
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add Sidebar with role-filtered nav items and collapsible toggle"
```

---

## Task 4: AppLayout.tsx

**Files:**
- Create: `casino_frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// casino_frontend/src/components/layout/AppLayout.tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AppHeader from './AppHeader'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-ci-void flex flex-col">
      {/* Header fijo arriba */}
      <AppHeader sidebarCollapsed={collapsed} />

      {/* Sidebar + contenido */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(prev => !prev)}
        />

        {/* Área de contenido */}
        <main className="flex-1 overflow-auto bg-ci-void">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/components/layout/AppLayout.tsx
git commit -m "feat: add AppLayout combining header, sidebar and outlet"
```

---

## Task 5: Integrar AppLayout en AppRouter.tsx

**Files:**
- Modify: `casino_frontend/src/router/AppRouter.tsx`

- [ ] **Step 1: Actualizar AppRouter.tsx**

Reemplaza el contenido completo del archivo con:

```tsx
// casino_frontend/src/router/AppRouter.tsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'

// ─── Carga diferida para reducir el bundle inicial ────────────────
const LoginPage     = lazy(() => import('@/modules/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/modules/reports/DashboardPage'))
const MenusPage     = lazy(() => import('@/modules/menus/MenusPage'))
const POSPage       = lazy(() => import('@/modules/pos/POSPage'))
const ReportsPage   = lazy(() => import('@/modules/reports/ReportsPage'))
const DinerApp      = lazy(() => import('@/features/diner/components/DinerApp'))

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
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* ── Comensales (vista móvil PWA) — sin AppLayout ─── */}
          <Route element={<ProtectedRoute allowedRoles={['diner']} />}>
            <Route path="/mi-casino" element={<DinerApp />} />
          </Route>

          {/* ── Rutas con layout (admin + operator) ──────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>

              {/* Cualquier usuario autenticado */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/menus"     element={<MenusPage />} />

              {/* Solo operators y admins */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'operator']} />}>
                <Route path="/pos" element={<POSPage />} />
              </Route>

              {/* Solo admins */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/reports" element={<ReportsPage />} />
              </Route>

            </Route>
          </Route>

          {/* Raíz y catch-all */}
          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/dashboard" replace />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd casino_frontend && npx tsc --noEmit --skipLibCheck 2>&1
```
Esperado: sin errores (o solo los errores preexistentes no relacionados con layout).

- [ ] **Step 3: Commit**

```bash
git add casino_frontend/src/router/AppRouter.tsx
git commit -m "feat: integrate AppLayout into router — wrap protected routes with header+sidebar"
```

---

## Task 6: Build y verificación visual

- [ ] **Step 1: Build de producción**

```bash
cd casino_frontend && npx vite build
```
Esperado: `✓ built in X.XXs` sin errores de compilación.

- [ ] **Step 2: Verificar en dev server**

```bash
cd casino_frontend && npx vite dev
```
Abre `http://localhost:5173`, inicia sesión y verifica:
- ✅ Header visible con logo CI + estado online
- ✅ Sidebar visible con los ítems según el rol
- ✅ Botón `‹` colapsa el sidebar a solo íconos
- ✅ Botón `›` lo expande de nuevo
- ✅ Item activo tiene borde izquierdo amber
- ✅ Usuario y botón Salir al fondo del sidebar
- ✅ `DinerApp` en `/mi-casino` NO tiene el layout

- [ ] **Step 3: Commit final + push**

```bash
git add .
git commit -m "feat: AppLayout complete — header + collapsible sidebar with role-based nav"
git push
```
