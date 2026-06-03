// ── Enum de métodos de pago (espejo del backend) ───────────────────
export type PaymentMethod = 'balance' | 'payroll_discount' | 'cash' | 'free'

// ── Ítem de menú ───────────────────────────────────────────────────
export interface MenuItemEntry {
  id: string
  name: string
  category: 'entrada' | 'fondo' | 'ensalada' | 'postre' | 'bebida' | 'otro'
}

// ── Menú del día (recibido del backend o mockeado) ─────────────────
export interface MenuOfDay {
  id: string
  name: string
  service_date: string          // YYYY-MM-DD
  description: string | null
  price: number                 // Precio fijo institucional (CLP)
  max_portions: number
  served_portions: number
  is_active: boolean
  items: MenuItemEntry[]
}

// ── Payload enviado a POST /transactions ──────────────────────────
export interface TransactionPayload {
  user_id?: string
  user_rut?: string
  qr_token?: string
  menu_id: string
  payment_method: PaymentMethod
  amount: number
  notes?: string
}

// ── Respuesta de POST /transactions ───────────────────────────────
export interface TransactionResult {
  id: string
  user_id: string
  menu_id: string
  operator_id: string
  reservation_id: string | null
  status: string
  payment_method: string
  amount: number
  created_at: string
}

// ── Entrada en el historial local del cajero ──────────────────────
export type EntryStatus = 'success' | 'error'

export interface RecentEntry {
  id: string
  identifier: string
  identifierType: 'rut' | 'qr'
  paymentMethod: PaymentMethod
  amount: number
  status: EntryStatus
  errorMsg?: string
  timestamp: Date
}

// ── Estado de la notificación en pantalla ─────────────────────────
export interface Notification {
  type: 'success' | 'error'
  message: string
}
