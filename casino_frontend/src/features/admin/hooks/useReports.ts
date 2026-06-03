/**
 * useReports — Datos del dashboard de administración.
 *
 * Genera datos mock dinámicamente según el rango de fechas seleccionado
 * (fines de semana con menos transacciones, días de semana con más).
 *
 * En producción: reemplazar el setTimeout por:
 *   reportsService.getDashboard({ start_date, end_date })
 *   → GET /api/v1/reports/dashboard?start_date=...&end_date=...
 */

import { useEffect, useState } from 'react'
import type { DashboardData, DateRange } from '../types'

// ── Generador de datos mock por rango ─────────────────────────────
function generateMockDashboard(range: DateRange): DashboardData {
  const startDate = new Date(range.start + 'T00:00:00')
  const endDate   = new Date(range.end   + 'T00:00:00')

  let totalTx      = 0
  let totalRevenue = 0
  const daily = []

  const cursor = new Date(startDate)
  // Semilla determinista basada en la fecha para reproducibilidad
  let seed = startDate.getTime()
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff }

  while (cursor <= endDate) {
    const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6
    const base  = isWeekend ? 5 : 70
    const count = Math.floor(rand() * (isWeekend ? 10 : 25) + base)
    const revenue = count * 3500

    daily.push({
      day: cursor.toISOString().split('T')[0],
      transaction_count: count,
      total_revenue: revenue,
      unique_diners: Math.floor(count * 0.96),
    })

    totalTx      += count
    totalRevenue += revenue
    cursor.setDate(cursor.getDate() + 1)
  }

  const byPayment = [
    { payment_method: 'balance',          transaction_count: Math.round(totalTx * 0.40), total_amount: Math.round(totalRevenue * 0.40), percentage: 40.0 },
    { payment_method: 'payroll_discount', transaction_count: Math.round(totalTx * 0.32), total_amount: Math.round(totalRevenue * 0.32), percentage: 32.0 },
    { payment_method: 'cash',             transaction_count: Math.round(totalTx * 0.22), total_amount: Math.round(totalRevenue * 0.22), percentage: 22.0 },
    { payment_method: 'free',             transaction_count: Math.round(totalTx * 0.06), total_amount: 0,                               percentage:  6.0 },
  ]

  return {
    start_date:          range.start,
    end_date:            range.end,
    total_transactions:  totalTx,
    total_revenue:       totalRevenue,
    total_unique_diners: Math.round(totalTx * 0.82),
    daily,
    by_payment_method:   byPayment,
  }
}

// ── Hook principal ────────────────────────────────────────────────
interface UseReportsResult {
  data:       DashboardData | null
  isLoading:  boolean
  errorCode:  number | null    // 422 si el servidor rechaza el rango
}

export function useReports(range: DateRange): UseReportsResult {
  const [data,      setData]      = useState<DashboardData | null>(null)
  const [isLoading, setLoading]   = useState(true)
  const [errorCode, setErrorCode] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    setErrorCode(null)

    const id = setTimeout(() => {
      // TODO en producción: reportsService.getDashboard(range)
      setData(generateMockDashboard(range))
      setLoading(false)
    }, 1_100)

    return () => clearTimeout(id)
  }, [range.start, range.end])

  return { data, isLoading, errorCode }
}
