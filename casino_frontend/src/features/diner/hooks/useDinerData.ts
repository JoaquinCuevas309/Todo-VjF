/**
 * useDinerData — Hooks de datos para la vista del comensal.
 *
 * En producción: reemplazar los setTimeout por llamadas reales:
 *   useDinerMenu   → GET /menus?service_date=<hoy>&only_active=true
 *   useDinerHistory → GET /transactions/mine?per_page=20
 *
 * Los delays simulan latencia de red móvil (≈1.2-1.8 s en 4G) para
 * que los skeleton loaders sean visibles durante el desarrollo.
 */

import { useEffect, useState } from 'react'
import type { DinerMenu, DinerTransaction } from '../types'

// ── Datos de ejemplo ──────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0]

const MOCK_MENU: DinerMenu = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Almuerzo Estándar',
  service_date: TODAY,
  description: 'Menú institucional del día',
  price: 3500,
  max_portions: 100,
  served_portions: 37,
  is_active: true,
  items: [
    { name: 'Crema de choclo',          category: 'entrada'  },
    { name: 'Pollo al horno con arroz', category: 'fondo'    },
    { name: 'Ensalada mixta',           category: 'ensalada' },
    { name: 'Fruta del tiempo',         category: 'postre'   },
  ],
}

const MOCK_TRANSACTIONS: DinerTransaction[] = [
  { id: '1', menu_name: 'Almuerzo Estándar', service_date: TODAY, payment_method: 'balance',          amount: 3500, status: 'completed', created_at: `${TODAY}T13:14:00Z` },
  { id: '2', menu_name: 'Almuerzo Estándar', service_date: '2024-06-03', payment_method: 'payroll_discount', amount: 3500, status: 'completed', created_at: '2024-06-03T13:22:00Z' },
  { id: '3', menu_name: 'Menú Especial',      service_date: '2024-06-02', payment_method: 'cash',             amount: 4200, status: 'completed', created_at: '2024-06-02T12:58:00Z' },
  { id: '4', menu_name: 'Almuerzo Estándar', service_date: '2024-05-31', payment_method: 'balance',          amount: 3500, status: 'completed', created_at: '2024-05-31T13:05:00Z' },
  { id: '5', menu_name: 'Almuerzo Estándar', service_date: '2024-05-30', payment_method: 'free',             amount: 0,    status: 'completed', created_at: '2024-05-30T13:11:00Z' },
  { id: '6', menu_name: 'Almuerzo Estándar', service_date: '2024-05-29', payment_method: 'payroll_discount', amount: 3500, status: 'completed', created_at: '2024-05-29T13:18:00Z' },
  { id: '7', menu_name: 'Menú Especial',      service_date: '2024-05-28', payment_method: 'cash',             amount: 4200, status: 'completed', created_at: '2024-05-28T12:55:00Z' },
]

// ── Hook: menú del día ────────────────────────────────────────────
export function useDinerMenu() {
  const [menu, setMenu]         = useState<DinerMenu | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const id = setTimeout(() => {
      // TODO → menus.service.getToday() o api.get('/menus?service_date=today')
      setMenu(MOCK_MENU)
      setLoading(false)
    }, 1_200)
    return () => clearTimeout(id)
  }, [])

  return { menu, isLoading, error } as const
}

// ── Hook: historial de consumos ───────────────────────────────────
export function useDinerHistory() {
  const [transactions, setTransactions] = useState<DinerTransaction[]>([])
  const [isLoading, setLoading]         = useState(true)
  const [error, setError]               = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const id = setTimeout(() => {
      // TODO → transactionService.mine() o api.get('/transactions/mine')
      setTransactions(MOCK_TRANSACTIONS)
      setLoading(false)
    }, 1_500)
    return () => clearTimeout(id)
  }, [])

  return { transactions, isLoading, error } as const
}

// ── Utilidad: saludo según hora del día ───────────────────────────
export function useGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}
