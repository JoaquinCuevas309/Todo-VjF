# MenusPage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la página `/menus` completa: tabla con filtros de fecha/estado, drawer lateral para crear/editar menús con ítems inline.

**Architecture:** Feature-based: todos los archivos viven en `src/features/menus/`. `MenusPage.tsx` orquesta `MenusTable` y `MenuDrawer`. La lógica de datos se separa en hooks (`useMenus`, `useMenuForm`). Sigue los patrones existentes del proyecto (axios directo, no React Query).

**Tech Stack:** React 18, TypeScript, react-hook-form, Zod, axios client existente (`@/api/client`), Tailwind `ci-*` tokens

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/features/menus/types.ts` | Crear | Tipos TS: MenuSummary, MenuOut, MenuItemOut |
| `src/features/menus/api/menusApi.ts` | Crear | Llamadas HTTP a /api/v1/menus |
| `src/features/menus/schemas/menuSchema.ts` | Crear | Validación Zod para crear y editar |
| `src/features/menus/hooks/useMenus.ts` | Crear | Listado + filtros |
| `src/features/menus/hooks/useMenuForm.ts` | Crear | Form state + submit crear/editar |
| `src/features/menus/components/MenuItemRow.tsx` | Crear | Fila dinámica de ítem en el form |
| `src/features/menus/components/MenuDrawer.tsx` | Crear | Panel lateral crear/editar |
| `src/features/menus/components/MenusTable.tsx` | Crear | Tabla principal con filtros |
| `src/modules/menus/MenusPage.tsx` | Modificar | Reemplaza stub con orquestador |

---

## Task 1: Tipos (`types.ts`)

**Files:**
- Create: `casino_frontend/src/features/menus/types.ts`

- [ ] **Step 1: Crear el archivo de tipos**

```ts
// casino_frontend/src/features/menus/types.ts

export interface MenuItemOut {
  id: string
  menu_id: string
  name: string
  category: string | null
  calories: number | null
  allergens: string[]
}

export interface MenuSummary {
  id: string
  service_date: string       // 'YYYY-MM-DD'
  name: string
  max_portions: number
  served_portions: number
  is_active: boolean
}

export interface MenuOut extends MenuSummary {
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
  items: MenuItemOut[]
}

export interface CreateMenuBody {
  name: string
  service_date: string
  max_portions: number
  description?: string
  items: {
    name: string
    category?: string | null
    calories?: number | null
    allergens?: string[]
  }[]
}

export interface UpdateMenuBody {
  name?: string
  max_portions?: number
  description?: string
  is_active?: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/features/menus/types.ts
git commit -m "feat(menus): add TypeScript types"
```

---

## Task 2: API (`menusApi.ts`)

**Files:**
- Create: `casino_frontend/src/features/menus/api/menusApi.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// casino_frontend/src/features/menus/api/menusApi.ts
import apiClient from '@/api/client'
import type { MenuSummary, MenuOut, CreateMenuBody, UpdateMenuBody } from '../types'

export const menusApi = {
  list(params?: { service_date?: string; only_active?: boolean }): Promise<MenuSummary[]> {
    return apiClient
      .get<MenuSummary[]>('/menus', { params })
      .then(r => r.data)
  },

  get(id: string): Promise<MenuOut> {
    return apiClient
      .get<MenuOut>(`/menus/${id}`)
      .then(r => r.data)
  },

  create(body: CreateMenuBody): Promise<MenuOut> {
    return apiClient
      .post<MenuOut>('/menus', body)
      .then(r => r.data)
  },

  update(id: string, body: UpdateMenuBody): Promise<MenuOut> {
    return apiClient
      .patch<MenuOut>(`/menus/${id}`, body)
      .then(r => r.data)
  },

  remove(id: string): Promise<void> {
    return apiClient
      .delete(`/menus/${id}`)
      .then(() => undefined)
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/features/menus/api/menusApi.ts
git commit -m "feat(menus): add menusApi HTTP client"
```

---

## Task 3: Schemas Zod (`menuSchema.ts`)

**Files:**
- Create: `casino_frontend/src/features/menus/schemas/menuSchema.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// casino_frontend/src/features/menus/schemas/menuSchema.ts
import { z } from 'zod'

const VALID_CATEGORIES = ['entrada', 'fondo', 'postre', 'bebida', 'ensalada', 'otro'] as const
const VALID_ALLERGENS  = ['gluten', 'lactosa', 'huevo', 'mariscos', 'nueces', 'soya', 'maní', 'pescado'] as const

export const menuItemSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(255),
  category: z.enum(VALID_CATEGORIES).nullable().optional(),
  calories: z.coerce.number().int().min(1).max(9999).nullable().optional(),
  allergens: z.array(z.enum(VALID_ALLERGENS)).default([]),
})

export const createMenuSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(255),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  max_portions: z.coerce.number().int().min(1, 'Mínimo 1').max(10000),
  description: z.string().max(1000).optional(),
  items: z.array(menuItemSchema).default([]),
})

export const updateMenuSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  max_portions: z.coerce.number().int().min(1).max(10000).optional(),
  description: z.string().max(1000).optional(),
  is_active: z.boolean().optional(),
})

export type CreateMenuForm = z.infer<typeof createMenuSchema>
export type UpdateMenuForm = z.infer<typeof updateMenuSchema>
export type MenuItemForm   = z.infer<typeof menuItemSchema>

export { VALID_CATEGORIES, VALID_ALLERGENS }
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/features/menus/schemas/menuSchema.ts
git commit -m "feat(menus): add Zod validation schemas"
```

---

## Task 4: Hook `useMenus.ts`

**Files:**
- Create: `casino_frontend/src/features/menus/hooks/useMenus.ts`

- [ ] **Step 1: Crear el hook**

```ts
// casino_frontend/src/features/menus/hooks/useMenus.ts
import { useCallback, useEffect, useState } from 'react'
import { menusApi } from '../api/menusApi'
import type { MenuSummary } from '../types'

export function useMenus() {
  const today = new Date().toISOString().split('T')[0]

  const [menus, setMenus]           = useState<MenuSummary[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [filterDate, setFilterDate] = useState<string>(today)
  const [onlyActive, setOnlyActive] = useState(true)

  const fetchMenus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await menusApi.list({
        service_date: filterDate || undefined,
        only_active:  onlyActive,
      })
      setMenus(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar menús')
    } finally {
      setIsLoading(false)
    }
  }, [filterDate, onlyActive])

  useEffect(() => { fetchMenus() }, [fetchMenus])

  const deleteMenu = useCallback(async (id: string) => {
    await menusApi.remove(id)
    setMenus(prev => prev.filter(m => m.id !== id))
  }, [])

  return {
    menus,
    isLoading,
    error,
    filterDate,
    setFilterDate,
    onlyActive,
    setOnlyActive,
    refetch: fetchMenus,
    deleteMenu,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/features/menus/hooks/useMenus.ts
git commit -m "feat(menus): add useMenus hook with filters and delete"
```

---

## Task 5: Hook `useMenuForm.ts`

**Files:**
- Create: `casino_frontend/src/features/menus/hooks/useMenuForm.ts`

- [ ] **Step 1: Crear el hook**

```ts
// casino_frontend/src/features/menus/hooks/useMenuForm.ts
import { useCallback } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { menusApi } from '../api/menusApi'
import { createMenuSchema, updateMenuSchema } from '../schemas/menuSchema'
import type { CreateMenuForm, UpdateMenuForm } from '../schemas/menuSchema'
import type { MenuOut } from '../types'

interface UseMenuFormProps {
  menu?: MenuOut
  onSuccess: () => void
}

export function useMenuForm({ menu, onSuccess }: UseMenuFormProps) {
  const isEdit = Boolean(menu)

  const form = useForm<CreateMenuForm>({
    resolver: zodResolver(isEdit ? updateMenuSchema : createMenuSchema),
    defaultValues: menu
      ? {
          name:          menu.name,
          service_date:  menu.service_date,
          max_portions:  menu.max_portions,
          description:   menu.description ?? '',
          items:         menu.items.map(i => ({
            name:      i.name,
            category:  i.category ?? undefined,
            calories:  i.calories ?? undefined,
            allergens: i.allergens,
          })),
        }
      : {
          name:         '',
          service_date: new Date().toISOString().split('T')[0],
          max_portions: 50,
          description:  '',
          items:        [],
        },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const addItem = useCallback(() => {
    append({ name: '', category: undefined, calories: undefined, allergens: [] })
  }, [append])

  const onSubmit = form.handleSubmit(async (data: CreateMenuForm) => {
    if (isEdit && menu) {
      const body: UpdateMenuForm = {
        name:          data.name,
        max_portions:  data.max_portions,
        description:   data.description || undefined,
      }
      await menusApi.update(menu.id, body)
    } else {
      await menusApi.create({
        name:          data.name,
        service_date:  data.service_date,
        max_portions:  data.max_portions,
        description:   data.description || undefined,
        items:         data.items,
      })
    }
    onSuccess()
  })

  return {
    form,
    fields,
    addItem,
    removeItem: remove,
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    isEdit,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/features/menus/hooks/useMenuForm.ts
git commit -m "feat(menus): add useMenuForm hook with create/edit support"
```

---

## Task 6: `MenuItemRow.tsx`

**Files:**
- Create: `casino_frontend/src/features/menus/components/MenuItemRow.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// casino_frontend/src/features/menus/components/MenuItemRow.tsx
import { useFormContext } from 'react-hook-form'
import { VALID_CATEGORIES } from '../schemas/menuSchema'
import type { CreateMenuForm } from '../schemas/menuSchema'

interface MenuItemRowProps {
  index: number
  onRemove: (index: number) => void
}

export default function MenuItemRow({ index, onRemove }: MenuItemRowProps) {
  const { register, formState: { errors } } = useFormContext<CreateMenuForm>()
  const itemErrors = errors.items?.[index]

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-start py-2 border-b border-ci-line last:border-0">
      {/* Nombre */}
      <div>
        <input
          {...register(`items.${index}.name`)}
          placeholder="Nombre del ítem *"
          className="w-full bg-ci-void border border-ci-line rounded-sm px-2 py-1.5 text-ci-primary font-mono text-xs placeholder:text-ci-muted focus:border-ci-amber/60 focus:outline-none"
        />
        {itemErrors?.name && (
          <p className="text-ci-error text-[10px] mt-0.5">{itemErrors.name.message}</p>
        )}
      </div>

      {/* Categoría */}
      <select
        {...register(`items.${index}.category`)}
        className="bg-ci-void border border-ci-line rounded-sm px-2 py-1.5 text-ci-secondary font-mono text-xs focus:border-ci-amber/60 focus:outline-none"
      >
        <option value="">Categoría</option>
        {VALID_CATEGORIES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {/* Calorías */}
      <input
        {...register(`items.${index}.calories`)}
        type="number"
        placeholder="Cal"
        min={1}
        max={9999}
        className="w-16 bg-ci-void border border-ci-line rounded-sm px-2 py-1.5 text-ci-secondary font-mono text-xs focus:border-ci-amber/60 focus:outline-none"
      />

      {/* Eliminar */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="text-ci-muted hover:text-ci-error transition-colors text-sm leading-none pt-2"
        title="Eliminar ítem"
      >
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/features/menus/components/MenuItemRow.tsx
git commit -m "feat(menus): add MenuItemRow dynamic form field"
```

---

## Task 7: `MenuDrawer.tsx`

**Files:**
- Create: `casino_frontend/src/features/menus/components/MenuDrawer.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// casino_frontend/src/features/menus/components/MenuDrawer.tsx
import { FormProvider } from 'react-hook-form'
import { useMenuForm } from '../hooks/useMenuForm'
import MenuItemRow from './MenuItemRow'
import type { MenuOut } from '../types'

interface MenuDrawerProps {
  open: boolean
  onClose: () => void
  menu?: MenuOut
  onSuccess: () => void
}

export default function MenuDrawer({ open, onClose, menu, onSuccess }: MenuDrawerProps) {
  const { form, fields, addItem, removeItem, onSubmit, isSubmitting, isEdit } = useMenuForm({
    menu,
    onSuccess: () => { onSuccess(); onClose() },
  })

  const { register, formState: { errors } } = form

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-ci-void/60 z-20"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={[
          'fixed top-0 right-0 h-full w-80 bg-ci-overlay border-l border-ci-line-active z-30',
          'flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ci-line shrink-0">
          <h2 className="font-display font-bold text-ci-primary text-lg tracking-wide">
            {isEdit ? 'Editar Menú' : 'Nuevo Menú'}
          </h2>
          <button
            onClick={onClose}
            className="text-ci-muted hover:text-ci-primary transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

            {/* Nombre */}
            <div>
              <label className="block font-mono text-[10px] text-ci-secondary uppercase tracking-widest mb-1">
                Nombre *
              </label>
              <input
                {...register('name')}
                placeholder="Almuerzo estándar"
                className="w-full bg-ci-void border border-ci-line rounded-sm px-3 py-2 text-ci-primary font-mono text-xs placeholder:text-ci-muted focus:border-ci-amber/60 focus:outline-none"
              />
              {errors.name && (
                <p className="text-ci-error text-[10px] mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Fecha + Porciones */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] text-ci-secondary uppercase tracking-widest mb-1">
                  Fecha *
                </label>
                <input
                  {...register('service_date')}
                  type="date"
                  disabled={isEdit}
                  className="w-full bg-ci-void border border-ci-line rounded-sm px-3 py-2 text-ci-primary font-mono text-xs focus:border-ci-amber/60 focus:outline-none disabled:opacity-50"
                />
                {errors.service_date && (
                  <p className="text-ci-error text-[10px] mt-1">{errors.service_date.message}</p>
                )}
              </div>
              <div>
                <label className="block font-mono text-[10px] text-ci-secondary uppercase tracking-widest mb-1">
                  Max. Porciones *
                </label>
                <input
                  {...register('max_portions')}
                  type="number"
                  min={1}
                  max={10000}
                  className="w-full bg-ci-void border border-ci-line rounded-sm px-3 py-2 text-ci-primary font-mono text-xs focus:border-ci-amber/60 focus:outline-none"
                />
                {errors.max_portions && (
                  <p className="text-ci-error text-[10px] mt-1">{errors.max_portions.message}</p>
                )}
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block font-mono text-[10px] text-ci-secondary uppercase tracking-widest mb-1">
                Descripción
              </label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Descripción opcional..."
                className="w-full bg-ci-void border border-ci-line rounded-sm px-3 py-2 text-ci-primary font-mono text-xs placeholder:text-ci-muted focus:border-ci-amber/60 focus:outline-none resize-none"
              />
            </div>

            {/* Ítems */}
            {!isEdit && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-mono text-[10px] text-ci-secondary uppercase tracking-widest">
                    Ítems ({fields.length})
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-ci-amber font-mono text-[10px] hover:text-ci-amber-bright transition-colors"
                  >
                    + Agregar ítem
                  </button>
                </div>
                <div className="border border-ci-line rounded-sm">
                  {fields.length === 0 ? (
                    <p className="text-ci-muted font-mono text-[10px] text-center py-4">
                      Sin ítems — el menú se puede crear sin ellos
                    </p>
                  ) : (
                    <div className="px-3">
                      {fields.map((field, index) => (
                        <MenuItemRow
                          key={field.id}
                          index={index}
                          onRemove={removeItem}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-2 mt-auto pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-ci-line py-2 rounded-sm text-ci-secondary font-mono text-xs hover:text-ci-primary hover:border-ci-amber/30 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-ci-amber text-ci-void font-mono text-xs font-bold py-2 rounded-sm hover:bg-ci-amber-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear Menú'}
              </button>
            </div>

          </form>
        </FormProvider>
      </aside>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/features/menus/components/MenuDrawer.tsx
git commit -m "feat(menus): add MenuDrawer with create/edit form and items"
```

---

## Task 8: `MenusTable.tsx`

**Files:**
- Create: `casino_frontend/src/features/menus/components/MenusTable.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// casino_frontend/src/features/menus/components/MenusTable.tsx
import { useAuth } from '@/hooks/useAuth'
import type { MenuSummary } from '../types'

interface MenusTableProps {
  menus: MenuSummary[]
  isLoading: boolean
  filterDate: string
  onlyActive: boolean
  onFilterDateChange: (date: string) => void
  onOnlyActiveChange: (val: boolean) => void
  onNew: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function PortionsBadge({ served, max }: { served: number; max: number }) {
  const pct = max > 0 ? served / max : 0
  const color = pct >= 1 ? 'text-ci-error' : pct >= 0.8 ? 'text-ci-warning' : 'text-ci-amber'
  return (
    <span className={`font-mono text-xs ${color}`}>
      {served}/{max}
    </span>
  )
}

const SkeletonRow = () => (
  <tr className="border-b border-ci-line">
    {[1,2,3,4,5].map(i => (
      <td key={i} className="px-3 py-3">
        <div className="h-3 bg-ci-overlay rounded animate-pulse" />
      </td>
    ))}
  </tr>
)

export default function MenusTable({
  menus, isLoading, filterDate, onlyActive,
  onFilterDateChange, onOnlyActiveChange,
  onNew, onEdit, onDelete,
}: MenusTableProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={filterDate}
            onChange={e => onFilterDateChange(e.target.value)}
            className="bg-ci-void border border-ci-line rounded-sm px-3 py-1.5 text-ci-primary font-mono text-xs focus:border-ci-amber/60 focus:outline-none"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={e => onOnlyActiveChange(e.target.checked)}
              className="accent-ci-amber"
            />
            <span className="font-mono text-[10px] text-ci-secondary uppercase tracking-widest">
              Solo activos
            </span>
          </label>
        </div>
        <button
          onClick={onNew}
          className="bg-ci-amber text-ci-void font-mono text-xs font-bold px-4 py-1.5 rounded-sm hover:bg-ci-amber-bright transition-colors"
        >
          + Nuevo Menú
        </button>
      </div>

      {/* Tabla */}
      <div className="border border-ci-line rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ci-line bg-ci-base">
              <th className="text-left px-3 py-2 font-mono text-[10px] text-ci-muted uppercase tracking-widest">Fecha</th>
              <th className="text-left px-3 py-2 font-mono text-[10px] text-ci-muted uppercase tracking-widest">Nombre</th>
              <th className="text-right px-3 py-2 font-mono text-[10px] text-ci-muted uppercase tracking-widest">Porciones</th>
              <th className="text-center px-3 py-2 font-mono text-[10px] text-ci-muted uppercase tracking-widest">Estado</th>
              <th className="text-center px-3 py-2 font-mono text-[10px] text-ci-muted uppercase tracking-widest">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>{[1,2,3].map(i => <SkeletonRow key={i} />)}</>
            ) : menus.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center font-mono text-xs text-ci-muted">
                  No hay menús para esta fecha
                </td>
              </tr>
            ) : (
              menus.map(menu => (
                <tr key={menu.id} className="border-b border-ci-line hover:bg-ci-base/50 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-ci-secondary">{menu.service_date}</td>
                  <td className="px-3 py-3 font-mono text-xs text-ci-primary">{menu.name}</td>
                  <td className="px-3 py-3 text-right">
                    <PortionsBadge served={menu.served_portions} max={menu.max_portions} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-mono text-[10px] ${menu.is_active ? 'text-ci-success' : 'text-ci-muted'}`}>
                      {menu.is_active ? '● activo' : '○ inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => onEdit(menu.id)}
                        className="text-ci-secondary hover:text-ci-amber transition-colors font-mono text-xs"
                        title="Editar"
                      >
                        ✏
                      </button>
                      {isAdmin && menu.served_portions === 0 && (
                        <button
                          onClick={() => onDelete(menu.id)}
                          className="text-ci-secondary hover:text-ci-error transition-colors font-mono text-xs"
                          title="Eliminar"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/features/menus/components/MenusTable.tsx
git commit -m "feat(menus): add MenusTable with filters, skeleton and role-based delete"
```

---

## Task 9: `MenusPage.tsx`

**Files:**
- Modify: `casino_frontend/src/modules/menus/MenusPage.tsx`

- [ ] **Step 1: Reemplazar el stub**

```tsx
// casino_frontend/src/modules/menus/MenusPage.tsx
import { useState } from 'react'
import { useMenus } from '@/features/menus/hooks/useMenus'
import { menusApi } from '@/features/menus/api/menusApi'
import MenusTable from '@/features/menus/components/MenusTable'
import MenuDrawer from '@/features/menus/components/MenuDrawer'
import type { MenuOut } from '@/features/menus/types'

export default function MenusPage() {
  const {
    menus, isLoading, filterDate, onlyActive,
    setFilterDate, setOnlyActive, refetch, deleteMenu,
  } = useMenus()

  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [selectedMenu, setSelectedMenu] = useState<MenuOut | undefined>()

  const handleNew = () => {
    setSelectedMenu(undefined)
    setDrawerOpen(true)
  }

  const handleEdit = async (id: string) => {
    const menu = await menusApi.get(id)
    setSelectedMenu(menu)
    setDrawerOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este menú? Esta acción no se puede deshacer.')) return
    await deleteMenu(id)
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display font-black text-2xl text-ci-primary tracking-wide">
          Menús
        </h1>
        <p className="font-mono text-xs text-ci-secondary mt-1">
          Gestión de menús y porciones por fecha de servicio
        </p>
      </div>

      <MenusTable
        menus={menus}
        isLoading={isLoading}
        filterDate={filterDate}
        onlyActive={onlyActive}
        onFilterDateChange={setFilterDate}
        onOnlyActiveChange={setOnlyActive}
        onNew={handleNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <MenuDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        menu={selectedMenu}
        onSuccess={refetch}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add casino_frontend/src/modules/menus/MenusPage.tsx
git commit -m "feat(menus): implement MenusPage replacing empty stub"
```

---

## Task 10: Build y verificación

- [ ] **Step 1: Build de producción**

```bash
cd casino_frontend && npx vite build
```
Esperado: `✓ built in X.XXs` sin errores nuevos.

- [ ] **Step 2: Verificar en dev server**

```bash
npx vite dev
```

Verifica en `http://localhost:5173/menus`:
- ✅ Tabla carga con filtro de fecha (hoy por defecto)
- ✅ Toggle "Solo activos" funciona
- ✅ Botón "+ Nuevo Menú" abre el drawer desde la derecha
- ✅ Formulario valida en tiempo real
- ✅ Se puede agregar/quitar ítems
- ✅ Submit crea el menú y cierra el drawer
- ✅ Botón ✏ carga los datos del menú en el drawer
- ✅ Botón 🗑 solo visible para admin con served_portions === 0

- [ ] **Step 3: Push**

```bash
git push
```
