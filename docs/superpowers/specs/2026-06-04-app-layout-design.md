# Design Spec: AppLayout + Navbar — Casino Institucional

**Date:** 2026-06-04
**Status:** Approved
**Scope:** Crear el layout de navegación principal que envuelve todas las rutas protegidas (admin/operator)

---

## 1. Problema

`AppRouter.tsx` renderiza cada página en aislamiento — no existe `Layout.tsx` ni componente `Navbar`. El `ProtectedRoute` solo hace `<Outlet />` sin ningún contenedor de navegación.

---

## 2. Diseño aprobado

**Header + Sidebar colapsable** con usuario al fondo del sidebar.

```
┌─────────────────────────────────────────┐
│  [CI]  CASINO INSTITUCIONAL    ● online │  ← Header fijo
├──────────┬──────────────────────────────┤
│ [‹]      │                              │
│ 📊 Dash  │                              │
│ 🍽 Menús │    <Outlet />                │
│ 💳 POS   │    (contenido de la página)  │
│ 📈 Rep.  │                              │
│──────────│                              │
│ [A] rol  │                              │
│ ⎋ Salir  │                              │
└──────────┴──────────────────────────────┘
     ↕ toggle collapsa a iconos solos
```

---

## 3. Componentes a crear

### `src/components/layout/AppLayout.tsx`
- Contenedor principal: `<header> + <aside> + <main>`
- Maneja estado `collapsed: boolean` (useState, default false)
- Renderiza `<Outlet />` en el área de contenido

### `src/components/layout/Sidebar.tsx`
- Recibe props: `collapsed`, `onToggle`, `user`
- Renderiza nav items filtrados por rol
- Fondo: usuario + logout

### `src/components/layout/NavItem.tsx`
- Props: `to`, `icon`, `label`, `collapsed`
- Usa `NavLink` de react-router-dom para la clase activa
- Activo: `border-left: 2px solid ci-amber` + `bg-ci-amber/8` + `text-ci-amber`
- Inactivo: `text-ci-secondary`, hover `text-ci-primary`

### `src/components/layout/AppHeader.tsx`
- Logo `CI` con borde amber
- Texto "CASINO INSTITUCIONAL" (oculto cuando sidebar colapsado)
- Indicador online: punto verde + "Sistema en línea"
- Versión V1.0.0

---

## 4. Rutas por rol

| Ruta | Icono | admin | operator |
|---|---|---|---|
| `/dashboard` | 📊 | ✅ | ✅ |
| `/menus` | 🍽 | ✅ | ✅ |
| `/pos` | 💳 | ✅ | ✅ |
| `/reports` | 📈 | ✅ | ❌ |

Los `diner` usan `/mi-casino` con su propio `DinerApp` — sin este layout.

---

## 5. Sidebar colapsable

- **Expandido** (default): ancho `w-36` — muestra icono + texto
- **Colapsado**: ancho `w-10` — muestra solo icono, centrado
- Toggle: botón `‹` / `›` en la parte superior del sidebar
- Transición CSS: `transition-all duration-300`
- Tooltip en modo colapsado: `title` attribute en cada NavItem

---

## 6. Usuario al fondo del sidebar

- Avatar circular con inicial del rol (A/O)
- Nombre del rol en mayúsculas
- Texto `ADMINISTRADOR` / `OPERADOR` debajo
- Botón `⎋ Salir` que llama `logout()` del AuthContext
- En modo colapsado: solo avatar + icono salir

---

## 7. Integración en AppRouter.tsx

Envolver las rutas protegidas con `AppLayout`:

```tsx
// Antes:
<Route element={<ProtectedRoute />}>
  <Route path="/dashboard" element={<DashboardPage />} />
  ...
</Route>

// Después:
<Route element={<ProtectedRoute />}>
  <Route element={<AppLayout />}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/menus"     element={<MenusPage />} />
    <Route path="/pos"       element={<POSPage />} />
    <Route path="/reports"   element={<ReportsPage />} />
  </Route>
</Route>
```

`DinerApp` queda sin `AppLayout` — tiene su propia navegación móvil.

---

## 8. Tokens de diseño usados

| Elemento | Clase Tailwind |
|---|---|
| Fondo sidebar | `bg-ci-base` |
| Borde sidebar | `border-ci-line` |
| Item activo bg | `bg-ci-amber/8` |
| Item activo border | `border-l-2 border-ci-amber` |
| Item activo text | `text-ci-amber` |
| Item inactivo | `text-ci-secondary hover:text-ci-primary` |
| Header bg | `bg-ci-base border-b border-ci-line` |
| Transición | `transition-all duration-300` |

---

## 9. Out of scope

- Persistir estado collapsed en localStorage
- Animaciones de entrada/salida del sidebar en mobile
- Breadcrumbs
- Notificaciones en el header
