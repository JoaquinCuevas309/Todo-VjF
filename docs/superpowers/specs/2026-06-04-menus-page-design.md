# Design Spec: MenusPage — Gestión de Menús

**Date:** 2026-06-04
**Status:** Approved
**Scope:** Implementar la página `/menus` completa: tabla con filtros + drawer lateral para crear/editar menús con ítems inline.

---

## 1. Contexto

El backend ya tiene 7 endpoints operativos en `/api/v1/menus`. El frontend tiene un stub vacío en `src/modules/menus/MenusPage.tsx`. Esta spec cubre el frontend completo.

---

## 2. Diseño aprobado

**Tabla + filtros** con **Drawer lateral** y **gestión de ítems inline**.

---

## 3. Estructura de archivos

```
src/features/menus/
├── types.ts
├── api/menusApi.ts
├── hooks/useMenus.ts
├── hooks/useMenuForm.ts
├── schemas/menuSchema.ts
└── components/
    ├── MenusTable.tsx
    ├── MenuDrawer.tsx
    └── MenuItemRow.tsx
src/modules/menus/MenusPage.tsx   ← reemplaza stub
```

---

## 4. Tipos (`types.ts`)

```ts
export interface MenuSummary {
  id: string
  service_date: string      // 'YYYY-MM-DD'
  name: string
  max_portions: number
  served_portions: number
  is_active: boolean
}

export interface MenuItemOut {
  id: string
  menu_id: string
  name: string
  category: string | null
  calories: number | null
  allergens: string[]
}

export interface MenuOut extends MenuSummary {
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
  items: MenuItemOut[]
}
```

---

## 5. API (`api/menusApi.ts`)

Wraps axios client existente en `@/api/client`.

| Función | Método | Endpoint |
|---|---|---|
| `listMenus(date?, onlyActive?)` | GET | `/api/v1/menus` |
| `getMenu(id)` | GET | `/api/v1/menus/:id` |
| `createMenu(body)` | POST | `/api/v1/menus` |
| `updateMenu(id, body)` | PATCH | `/api/v1/menus/:id` |
| `deleteMenu(id)` | DELETE | `/api/v1/menus/:id` |

---

## 6. Schemas Zod (`schemas/menuSchema.ts`)

```ts
// Ítem
itemSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['entrada','fondo','postre','bebida','ensalada','otro']).nullable().optional(),
  calories: z.number().int().min(1).max(9999).nullable().optional(),
  allergens: z.array(z.string()).default([]),
})

// Crear menú
createMenuSchema = z.object({
  name: z.string().min(1).max(255),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  max_portions: z.number().int().min(1).max(10000),
  description: z.string().max(1000).optional(),
  items: z.array(itemSchema).default([]),
})

// Editar menú (campos opcionales)
updateMenuSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  max_portions: z.number().int().min(1).max(10000).optional(),
  description: z.string().max(1000).optional(),
  is_active: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined))
```

---

## 7. Hooks

### `useMenus.ts`
- State: `menus: MenuSummary[]`, `isLoading`, `error`
- State: `filterDate: string | null`, `onlyActive: boolean` (default true)
- Fetches on mount y cuando cambian los filtros
- Expone: `setFilterDate`, `setOnlyActive`, `refetch`

### `useMenuForm.ts`
- Props: `menu?: MenuOut` (si existe → modo edición)
- Maneja react-hook-form + Zod resolver
- Maneja lista dinámica de ítems (add/remove)
- Submit: llama `createMenu` o `updateMenu` según modo
- Expone: `form`, `items`, `addItem`, `removeItem`, `onSubmit`, `isSubmitting`

---

## 8. Componentes

### `MenusTable.tsx`
- Props: `menus`, `isLoading`, `onEdit(menu)`, `onDelete(id)`, `onNew()`
- Columnas: Fecha · Nombre · Porciones (servidas/máx) · Estado · Acciones
- Porciones: amber si `served/max >= 0.8`, rojo si `served === max`
- Botón eliminar: solo visible si `user.role === 'admin'` y `served_portions === 0`
- Skeleton loader mientras `isLoading`

### `MenuDrawer.tsx`
- Props: `open`, `onClose`, `menu?: MenuOut`, `onSuccess()`
- Título dinámico: "Nuevo Menú" / "Editar Menú"
- Campos: nombre*, fecha*, max_portions*, descripción
- Sección ítems: lista de `<MenuItemRow />` + botón "+ Agregar ítem"
- Submit llama `useMenuForm.onSubmit`, cierra drawer en éxito

### `MenuItemRow.tsx`
- Props: `index`, `onRemove(index)`
- Usa `useFormContext()` para registrarse en el form padre
- Campos: nombre*, categoría (select), calorías (number), alérgenos (multi checkboxes)

### `MenusPage.tsx` (reemplaza stub)
```tsx
export default function MenusPage() {
  // Orquesta MenusTable + MenuDrawer
  // Estado: drawerOpen, selectedMenu
}
```

---

## 9. Tokens de diseño

Sigue el sistema `ci-*` existente. Drawer usa `bg-ci-overlay` con `border-l border-ci-line-active`.

---

## 10. Permisos

| Acción | admin | operator |
|---|---|---|
| Ver lista | ✅ | ✅ |
| Crear | ✅ | ✅ |
| Editar | ✅ | ✅ |
| Eliminar | ✅ | ❌ |

El botón eliminar se oculta para operadores usando `useAuth().user.role`.

---

## 11. Out of scope

- Paginación (el listado se filtra por fecha, volumen bajo)
- Gestión de alérgenos como entidad separada
- Vista de menú para comensales (ya existe en DinerApp)
