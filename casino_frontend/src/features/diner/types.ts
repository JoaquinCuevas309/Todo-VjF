// ── Historial de consumos del comensal ────────────────────────────
export interface DinerTransaction {
  id: string
  menu_name: string | null
  service_date: string          // YYYY-MM-DD
  payment_method: string
  amount: number
  status: 'completed' | 'reversed' | 'pending'
  created_at: string            // ISO 8601
}

// ── Menú del día (versión simplificada para la vista del comensal) ─
export interface DinerMenu {
  id: string
  name: string
  service_date: string
  description: string | null
  price: number
  max_portions: number
  served_portions: number
  is_active: boolean
  items: { name: string; category: string }[]
}
