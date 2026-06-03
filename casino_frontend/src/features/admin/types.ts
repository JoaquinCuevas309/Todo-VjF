// ── Resumen diario (espejo de DailySummaryItem del backend) ──────
export interface DailySummary {
  day: string              // YYYY-MM-DD
  transaction_count: number
  total_revenue: number
  unique_diners: number
}

// ── Desglose por método de pago ───────────────────────────────────
export interface PaymentBreakdown {
  payment_method: string
  transaction_count: number
  total_amount: number
  percentage: number       // % sobre el total del período
}

// ── Dashboard completo (respuesta de GET /reports/dashboard) ─────
export interface DashboardData {
  start_date: string
  end_date: string
  total_transactions: number
  total_revenue: number
  total_unique_diners: number
  daily: DailySummary[]
  by_payment_method: PaymentBreakdown[]
}

// ── Rango de fechas aplicado ──────────────────────────────────────
export interface DateRange {
  start: string   // YYYY-MM-DD
  end: string     // YYYY-MM-DD
}
