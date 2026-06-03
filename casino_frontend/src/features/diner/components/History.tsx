/**
 * History.tsx — Historial de consumos del comensal.
 *
 * Simula GET /api/v1/transactions/mine con datos mockeados.
 * Las transacciones se agrupan por mes para facilitar la lectura.
 */

import { useDinerHistory } from '../hooks/useDinerData'
import { SkeletonHistory } from './Skeletons'
import type { DinerTransaction } from '../types'

// ── Config de métodos de pago ────────────────────────────────────
const PAYMENT_LABEL: Record<string, { label: string; colorClass: string }> = {
  balance:          { label: 'Saldo',    colorClass: 'bg-sky-500/10 text-sky-400 border-sky-500/25'       },
  payroll_discount: { label: 'Planilla', colorClass: 'bg-violet-500/10 text-violet-400 border-violet-500/25' },
  cash:             { label: 'Efectivo', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' },
  free:             { label: 'Gratuito', colorClass: 'bg-ci-amber/10 text-ci-amber border-ci-amber/25'    },
}

// ── Icono de plato SVG ───────────────────────────────────────────
const IconPlate = () => (
  <svg
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4l2.5 2.5" />
    <path d="M8 12h1" />
  </svg>
)

// ── Fila de transacción ──────────────────────────────────────────
function TransactionRow({ tx }: { tx: DinerTransaction }) {
  const config = PAYMENT_LABEL[tx.payment_method] ?? { label: tx.payment_method, colorClass: 'bg-ci-raised text-ci-muted border-ci-line' }
  const dateLabel = new Date(tx.service_date + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
  const timeLabel = new Date(tx.created_at).toLocaleTimeString('es-CL', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="flex items-center gap-3 border border-ci-line bg-ci-base p-3.5 transition-colors hover:bg-ci-raised/30">
      {/* Ícono */}
      <div className="w-9 h-9 rounded-full bg-ci-raised border border-ci-line flex items-center justify-center shrink-0 text-ci-amber">
        <IconPlate />
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ci-primary font-body truncate">
          {tx.menu_name ?? 'Almuerzo'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-ci-muted capitalize">{dateLabel}</span>
          <span className="text-ci-muted/40">·</span>
          <span className="font-mono text-[10px] text-ci-muted">{timeLabel}</span>
        </div>
      </div>

      {/* Derecha: badge + monto */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span
          className={`px-1.5 py-0.5 border text-[9px] font-mono tracking-wider uppercase ${config.colorClass}`}
        >
          {config.label}
        </span>
        <span className="font-mono text-xs text-ci-secondary">
          {tx.amount > 0 ? `$${tx.amount.toLocaleString('es-CL')}` : '—'}
        </span>
      </div>
    </div>
  )
}

// ── Agrupar transacciones por mes ────────────────────────────────
function groupByMonth(txs: DinerTransaction[]): [string, DinerTransaction[]][] {
  const map = new Map<string, DinerTransaction[]>()
  for (const tx of txs) {
    const key = new Date(tx.created_at).toLocaleDateString('es-CL', {
      month: 'long', year: 'numeric',
    })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(tx)
  }
  return [...map.entries()]
}

// ═════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════
export default function History() {
  const { transactions, isLoading } = useDinerHistory()

  if (isLoading) {
    return <SkeletonHistory />
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center animate-fade-in">
        <div
          className="w-16 h-16 border border-ci-line bg-ci-base flex items-center justify-center mb-4 text-ci-muted"
          aria-hidden
        >
          <IconPlate />
        </div>
        <p className="font-display font-bold text-xl text-ci-primary mb-1">Sin registros</p>
        <p className="text-sm text-ci-secondary font-body">
          Tus consumos aparecerán aquí después de usar el sistema.
        </p>
      </div>
    )
  }

  const grouped = groupByMonth(transactions)
  const totalSpent = transactions
    .filter((t) => t.status === 'completed' && t.amount > 0)
    .reduce((acc, t) => acc + t.amount, 0)

  return (
    <div className="flex-1 px-4 pt-5 pb-4 space-y-5 animate-fade-in">

      {/* ── Resumen total ─────────────────────────────────────── */}
      <div className="border border-ci-line bg-ci-base p-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase">Total consumido</p>
          <p className="font-display font-bold text-2xl text-ci-primary mt-0.5">
            {transactions.length} <span className="text-base text-ci-muted font-light">almuerzos</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase">Monto total</p>
          <p className="font-display font-bold text-xl text-ci-amber mt-0.5">
            ${totalSpent.toLocaleString('es-CL')}
          </p>
        </div>
      </div>

      {/* ── Transacciones agrupadas por mes ────────────────────── */}
      {grouped.map(([month, txs]) => (
        <section key={month} className="space-y-2">
          <p className="font-mono text-[10px] tracking-[0.3em] text-ci-muted uppercase capitalize px-0.5">
            {month}
          </p>
          {txs.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </section>
      ))}

    </div>
  )
}
