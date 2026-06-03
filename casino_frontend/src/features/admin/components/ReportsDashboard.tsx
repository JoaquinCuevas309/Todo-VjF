/**
 * ReportsDashboard.tsx — Panel de control de administración.
 *
 * Protección: accesible solo con rol 'admin' (declarado en AppRouter).
 *
 * Secciones:
 *  1. Header   — título + selector de fechas + botón CSV
 *  2. KPIs     — 4 tarjetas con contador animado
 *  3. Gráficos — BarChart (consumo diario) + PieChart (métodos de pago)
 *  4. Tabla    — desglose detallado por método de pago
 *
 * Validaciones UI:
 *  • end_date < start_date   → error inline inmediato
 *  • rango > 31 días         → error inline (espejo de la restricción del backend)
 *  • error 422 del servidor  → banner de error amigable
 *  • Skeleton loaders        → al cambiar el rango y mientras carga
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell,
  Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { useReports } from '../hooks/useReports'
import type { DailySummary, DateRange, PaymentBreakdown } from '../types'

// ═════════════════════════════════════════════════════════════════════
// CONSTANTES Y UTILIDADES
// ═════════════════════════════════════════════════════════════════════

const MAX_DAYS = 31

// Colores JavaScript para recharts (no puede usar CSS variables)
const C = {
  amber:   '#F59E0B',
  amberDim:'#92660A',
  grid:    'rgba(245,158,11,0.06)',
  axis:    '#3D4460',
  text:    '#7A8299',
  bg:      '#0C1120',
  border:  'rgba(245,158,11,0.2)',
}

const PAYMENT_COLORS: Record<string, string> = {
  balance:          '#38BDF8',   // sky-400
  payroll_discount: '#A78BFA',   // violet-400
  cash:             '#34D399',   // emerald-400
  free:             '#F59E0B',   // amber
}

const PAYMENT_LABELS: Record<string, string> = {
  balance:          'Saldo',
  payroll_discount: 'Planilla',
  cash:             'Efectivo',
  free:             'Gratuito',
}

function today()      { return new Date().toISOString().split('T')[0] }
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}
function fmtDay(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}
function fmtCLP(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}
function fmtCLPFull(v: number) {
  return `$${v.toLocaleString('es-CL')}`
}

// ═════════════════════════════════════════════════════════════════════
// HOOK: CONTADOR ANIMADO
// ═════════════════════════════════════════════════════════════════════

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    let start: number | null = null

    const animate = (ts: number) => {
      if (!start) start = ts
      const pct   = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - pct, 3)   // ease-out cubic
      setValue(Math.floor(eased * target))
      if (pct < 1) rafRef.current = requestAnimationFrame(animate)
      else         setValue(target)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}

// ═════════════════════════════════════════════════════════════════════
// SKELETONS
// ═════════════════════════════════════════════════════════════════════

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-ci-raised/80 ${className}`} aria-hidden />
}

function SkeletonKPI() {
  return (
    <div className="border border-ci-line bg-ci-base p-5 space-y-3">
      <Pulse className="h-3 w-20" />
      <Pulse className="h-8 w-32" />
      <Pulse className="h-3 w-14" />
    </div>
  )
}

function SkeletonChart({ height = 240 }: { height?: number }) {
  return (
    <Pulse className="w-full" style={{ height }} />
  )
}

// ═════════════════════════════════════════════════════════════════════
// TARJETA KPI
// ═════════════════════════════════════════════════════════════════════

interface KPICardProps {
  label:     string
  value:     number
  format:    (v: number) => string
  sublabel?: string
  color:     string   // hex
  icon:      React.ReactNode
}

function KPICard({ label, value, format, sublabel, color, icon }: KPICardProps) {
  const animated = useCountUp(value)

  return (
    <div
      className="border border-ci-line bg-ci-base p-5 flex flex-col gap-3 relative overflow-hidden animate-slide-up"
      style={{ borderTopColor: color, borderTopWidth: '2px' }}
    >
      {/* Glow de fondo */}
      <div
        aria-hidden
        className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color}14 0%, transparent 70%)` }}
      />

      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase">{label}</p>
        <span style={{ color }} className="opacity-60">{icon}</span>
      </div>

      <p className="font-display font-black text-3xl text-ci-primary leading-none tabular-nums">
        {format(animated)}
      </p>

      {sublabel && (
        <p className="font-mono text-[10px] text-ci-muted">{sublabel}</p>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// PANEL: GRÁFICO DE BARRAS
// ═════════════════════════════════════════════════════════════════════

type BarMetric = 'transactions' | 'revenue'

function BarChartPanel({ daily }: { daily: DailySummary[] }) {
  const [metric, setMetric] = useState<BarMetric>('transactions')

  const TOOLTIP_STYLE = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    color: '#E8ECF5',
    fontFamily: 'IBM Plex Mono',
    fontSize: '11px',
    borderRadius: 0,
    boxShadow: 'none',
  }

  return (
    <div className="border border-ci-line bg-ci-base p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase">
          Consumo diario
        </p>
        {/* Toggle métrica */}
        <div className="flex border border-ci-line overflow-hidden">
          {(['transactions', 'revenue'] as BarMetric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={[
                'px-3 py-1 font-mono text-[9px] tracking-widest uppercase transition-colors',
                metric === m
                  ? 'bg-ci-amber/10 text-ci-amber'
                  : 'text-ci-muted hover:text-ci-secondary',
              ].join(' ')}
            >
              {m === 'transactions' ? 'Transacciones' : 'Recaudación'}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={daily} margin={{ top: 4, right: 4, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={fmtDay}
            tick={{ fill: C.axis, fontSize: 10, fontFamily: 'IBM Plex Mono' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={metric === 'revenue' ? fmtCLP : String}
            tick={{ fill: C.axis, fontSize: 10, fontFamily: 'IBM Plex Mono' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'rgba(245,158,11,0.05)' }}
            labelFormatter={fmtDay}
            formatter={(val: number) =>
              metric === 'revenue'
                ? [fmtCLPFull(val), 'Recaudación']
                : [val, 'Transacciones']
            }
          />
          <Bar
            dataKey={metric === 'revenue' ? 'total_revenue' : 'transaction_count'}
            fill={C.amber}
            maxBarSize={36}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// PANEL: GRÁFICO CIRCULAR
// ═════════════════════════════════════════════════════════════════════

function PieChartPanel({ data }: { data: PaymentBreakdown[] }) {
  const pieData = data
    .filter((d) => d.transaction_count > 0)
    .map((d) => ({
      name:           PAYMENT_LABELS[d.payment_method] ?? d.payment_method,
      value:          d.percentage,
      payment_method: d.payment_method,
      total_amount:   d.total_amount,
    }))

  const TOOLTIP_STYLE = {
    background: '#0C1120',
    border: 'rgba(245,158,11,0.2)',
    color: '#E8ECF5',
    fontFamily: 'IBM Plex Mono',
    fontSize: '11px',
    borderRadius: 0,
  }

  // Renderizador de label personalizado en el centro del donut
  const CenterLabel = ({ cx, cy }: { cx?: number; cy?: number }) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan
        x={cx}
        dy="-8"
        style={{ fontFamily: '"Barlow Condensed"', fontWeight: 700, fontSize: '22px', fill: '#E8ECF5' }}
      >
        {pieData.length}
      </tspan>
      <tspan
        x={cx}
        dy="20"
        style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', fill: '#3D4460', letterSpacing: '0.2em' }}
      >
        MÉTODOS
      </tspan>
    </text>
  )

  return (
    <div className="border border-ci-line bg-ci-base p-5 flex flex-col gap-4">
      <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase">
        Métodos de pago
      </p>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
          >
            {pieData.map((entry, i) => (
              <Cell
                key={i}
                fill={PAYMENT_COLORS[entry.payment_method] ?? C.amber}
                stroke="transparent"
              />
            ))}
            {/* @ts-expect-error recharts label type */}
            <CenterLabel />
          </Pie>
          <Tooltip
            contentStyle={{
              background: TOOLTIP_STYLE.background,
              border: `1px solid ${TOOLTIP_STYLE.border}`,
              color: TOOLTIP_STYLE.color,
              fontFamily: TOOLTIP_STYLE.fontFamily,
              fontSize: TOOLTIP_STYLE.fontSize,
              borderRadius: 0,
              boxShadow: 'none',
            }}
            formatter={(val: number, name: string) => [
              `${val.toFixed(1)}%`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Leyenda personalizada */}
      <ul className="space-y-2">
        {pieData.map((entry) => (
          <li key={entry.payment_method} className="flex items-center gap-2.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: PAYMENT_COLORS[entry.payment_method] ?? C.amber }}
            />
            <span className="font-body text-xs text-ci-secondary flex-1">{entry.name}</span>
            <span className="font-mono text-xs text-ci-muted">{entry.value.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// TABLA DE MÉTODOS DE PAGO
// ═════════════════════════════════════════════════════════════════════

function PaymentTable({ data, totalRevenue }: { data: PaymentBreakdown[]; totalRevenue: number }) {
  return (
    <div className="border border-ci-line bg-ci-base p-5 overflow-x-auto">
      <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-4">
        Desglose por método de pago
      </p>
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="border-b border-ci-line">
            {['Método', 'Transacciones', 'Recaudado', '% Recaudación', 'Prom. por tx'].map((h) => (
              <th
                key={h}
                className="pb-3 text-left font-mono text-[10px] tracking-widest text-ci-muted uppercase pr-4"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const avg = row.transaction_count > 0 && row.total_amount > 0
              ? Math.round(row.total_amount / row.transaction_count)
              : 0
            const revPct = totalRevenue > 0
              ? (row.total_amount / totalRevenue * 100).toFixed(1)
              : '0.0'

            return (
              <tr key={row.payment_method} className="border-b border-ci-line/50 hover:bg-ci-raised/30 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: PAYMENT_COLORS[row.payment_method] ?? C.amber }}
                    />
                    <span className="font-body text-ci-primary">
                      {PAYMENT_LABELS[row.payment_method] ?? row.payment_method}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4 font-mono text-ci-secondary tabular-nums">
                  {row.transaction_count.toLocaleString('es-CL')}
                </td>
                <td className="py-3 pr-4 font-mono text-ci-secondary tabular-nums">
                  {row.total_amount > 0 ? fmtCLPFull(row.total_amount) : '—'}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-ci-raised overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${revPct}%`,
                          background: PAYMENT_COLORS[row.payment_method] ?? C.amber,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs text-ci-muted tabular-nums">
                      {revPct}%
                    </span>
                  </div>
                </td>
                <td className="py-3 font-mono text-ci-secondary tabular-nums">
                  {avg > 0 ? fmtCLPFull(avg) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════

const DEFAULT_START = daysAgo(6)
const DEFAULT_END   = today()

export default function ReportsDashboard() {
  const [startDate, setStartDate] = useState(DEFAULT_START)
  const [endDate,   setEndDate]   = useState(DEFAULT_END)
  const [range,     setRange]     = useState<DateRange>({ start: DEFAULT_START, end: DEFAULT_END })
  const [rangeErr,  setRangeErr]  = useState<string | null>(null)

  const { data, isLoading, errorCode } = useReports(range)

  // ── Validación y aplicación del filtro ──────────────────────────
  const applyFilter = useCallback(() => {
    setRangeErr(null)

    if (endDate < startDate) {
      setRangeErr('La fecha de inicio debe ser anterior a la de fin.')
      return
    }
    const span = daysBetween(startDate, endDate)
    if (span > MAX_DAYS) {
      setRangeErr(`El rango seleccionado (${span} días) supera el máximo permitido (${MAX_DAYS} días).`)
      return
    }
    setRange({ start: startDate, end: endDate })
  }, [startDate, endDate])

  // Aplicar al presionar Enter en cualquier input de fecha
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyFilter()
  }

  // ── Exportar CSV ─────────────────────────────────────────────────
  const exportCSV = () => {
    // Exporta el día de inicio del rango
    const url = `/api/v1/reports/export/csv?export_date=${range.start}`
    const a   = document.createElement('a')
    a.href     = url
    a.download = `transacciones_${range.start}.csv`
    a.click()
  }

  // ── Cálculos derivados ───────────────────────────────────────────
  const avgTx = data && data.total_transactions > 0
    ? Math.round(data.total_revenue / data.total_transactions)
    : 0

  const DATE_LABEL = `${fmtDay(range.start)} — ${fmtDay(range.end)}`

  // INPUT STYLE común
  const INPUT_CLS = [
    'bg-ci-base border border-ci-line text-ci-primary',
    'font-mono text-sm px-3 py-2 w-full sm:w-auto',
    'focus:outline-none focus:border-ci-amber/60 transition-colors',
  ].join(' ')

  return (
    <div className="min-h-screen bg-ci-void bg-grid">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-ci-line bg-ci-base/80 backdrop-blur-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-ci-muted uppercase">Administración</p>
          <h1 className="font-display font-black text-2xl text-ci-primary tracking-wide uppercase mt-0.5">
            Reportes y Auditoría
          </h1>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-2 border border-ci-line px-4 py-2 text-ci-secondary hover:text-ci-amber hover:border-ci-amber/40 transition-colors font-mono text-xs tracking-widest uppercase"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Exportar CSV
        </button>
      </header>

      <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">

        {/* ── Selector de fechas ──────────────────────────────── */}
        <div className="border border-ci-line bg-ci-base p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[9px] tracking-[0.25em] text-ci-muted uppercase">
              Desde
            </label>
            <input
              type="date"
              value={startDate}
              max={today()}
              onChange={(e) => { setStartDate(e.target.value); setRangeErr(null) }}
              onKeyDown={handleKeyDown}
              className={INPUT_CLS}
              style={{ colorScheme: 'dark' }}
              aria-label="Fecha de inicio"
            />
          </div>

          <span className="font-mono text-ci-muted pb-2 hidden sm:block">→</span>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[9px] tracking-[0.25em] text-ci-muted uppercase">
              Hasta
            </label>
            <input
              type="date"
              value={endDate}
              max={today()}
              onChange={(e) => { setEndDate(e.target.value); setRangeErr(null) }}
              onKeyDown={handleKeyDown}
              className={INPUT_CLS}
              style={{ colorScheme: 'dark' }}
              aria-label="Fecha de fin"
            />
          </div>

          <button
            onClick={applyFilter}
            className="bg-ci-amber text-ci-void font-display font-bold text-sm tracking-[0.2em] uppercase px-5 py-2 hover:bg-ci-amber-bright transition-colors whitespace-nowrap"
          >
            Aplicar filtro
          </button>

          {!rangeErr && !isLoading && (
            <p className="font-mono text-[10px] text-ci-muted self-end pb-2.5 hidden md:block">
              {DATE_LABEL}
            </p>
          )}
        </div>

        {/* ── Banners de error ─────────────────────────────────── */}
        {rangeErr && (
          <div
            role="alert"
            className="border border-ci-error/25 bg-ci-error/5 p-3.5 flex gap-2.5 animate-slide-up"
          >
            <svg className="w-4 h-4 shrink-0 text-ci-error mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-sm text-ci-error/90 font-body">{rangeErr}</p>
          </div>
        )}

        {errorCode === 422 && (
          <div role="alert" className="border border-ci-error/25 bg-ci-error/5 p-3.5 flex gap-2.5 animate-slide-up">
            <p className="text-sm text-ci-error/90 font-body">
              El servidor rechazó el rango solicitado (422). El máximo permitido es {MAX_DAYS} días por consulta.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            KPIs
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonKPI key={i} />)
          ) : data ? (
            <>
              <KPICard
                label="Total Recaudado"
                value={data.total_revenue}
                format={fmtCLPFull}
                sublabel={`${data.total_transactions} transacciones`}
                color="#F59E0B"
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                  </svg>
                }
              />
              <KPICard
                label="Transacciones"
                value={data.total_transactions}
                format={String}
                color="#38BDF8"
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                }
              />
              <KPICard
                label="Comensales Únicos"
                value={data.total_unique_diners}
                format={String}
                color="#34D399"
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                }
              />
              <KPICard
                label="Promedio por Tx"
                value={avgTx}
                format={fmtCLPFull}
                color="#A78BFA"
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <path d="M18 20V10M12 20V4M6 20v-6"/>
                  </svg>
                }
              />
            </>
          ) : null}
        </div>

        {/* ══════════════════════════════════════════════════════
            GRÁFICOS
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* BarChart — ocupa 2/3 del grid en desktop */}
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="border border-ci-line bg-ci-base p-5 space-y-4">
                <Pulse className="h-3 w-28" />
                <SkeletonChart height={220} />
              </div>
            ) : data ? (
              <BarChartPanel daily={data.daily} />
            ) : null}
          </div>

          {/* PieChart — ocupa 1/3 */}
          <div className="lg:col-span-1">
            {isLoading ? (
              <div className="border border-ci-line bg-ci-base p-5 space-y-4">
                <Pulse className="h-3 w-28" />
                <SkeletonChart height={200} />
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Pulse className="w-2.5 h-2.5 rounded-full shrink-0" />
                      <Pulse className="flex-1 h-3" />
                      <Pulse className="w-8 h-3" />
                    </div>
                  ))}
                </div>
              </div>
            ) : data ? (
              <PieChartPanel data={data.by_payment_method} />
            ) : null}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            TABLA DETALLADA
        ══════════════════════════════════════════════════════ */}
        {isLoading ? (
          <div className="border border-ci-line bg-ci-base p-5 space-y-3">
            <Pulse className="h-3 w-36" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4 py-2 border-b border-ci-line/50">
                <Pulse className="w-24 h-4" />
                <Pulse className="w-20 h-4" />
                <Pulse className="w-28 h-4" />
                <Pulse className="w-24 h-4" />
                <Pulse className="w-20 h-4" />
              </div>
            ))}
          </div>
        ) : data ? (
          <PaymentTable data={data.by_payment_method} totalRevenue={data.total_revenue} />
        ) : null}

      </div>
    </div>
  )
}
