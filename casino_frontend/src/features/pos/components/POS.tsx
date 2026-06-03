/**
 * POS.tsx — Pantalla del Punto de Venta.
 *
 * Layout: 2 columnas en ≥lg / apilado en mobile.
 *
 * Seguridad implementada:
 *  • Anti-doble-submit: botón + input deshabilitados durante isSubmitting.
 *    Crítico para scanners de barras que disparan múltiples Enter rápidos.
 *  • Mensajes de error específicos por código HTTP (ver usePOS + resolveTransactionError).
 *  • Validación Zod antes de llamar a la API (QR regex / RUT formato).
 *  • Auto-focus del input activo al cambiar de tab: el escáner no requiere clic.
 */

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { usePOS } from '../hooks/usePOS'
import { qrSchema, rutSchema, PAYMENT_METHODS } from '../schemas/posSchema'
import type { PaymentMethod, MenuOfDay, RecentEntry } from '../types'
import type { QRFormData, RUTFormData } from '../schemas/posSchema'

// ── Reloj en tiempo real ──────────────────────────────────────────
function useClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Iconos SVG inline ─────────────────────────────────────────────
const IconQR = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><path d="M14 14h1v1h-1zM17 14h1v1h-1zM14 17h1v1h-1zM20 14v7h-3M20 14h-3" />
  </svg>
)
const IconID = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <circle cx="9" cy="12" r="2" /><path d="M13 11h4M13 15h2" />
  </svg>
)
const IconCheck = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const IconX = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const IconSpinner = () => (
  <span className="w-4 h-4 rounded-full border-2 border-ci-void/30 border-t-ci-void animate-spin" aria-hidden />
)

// ── Config de métodos de pago ─────────────────────────────────────
const PAYMENT_CONFIG: Record<PaymentMethod, { label: string; shortLabel: string; colorClass: string }> = {
  balance:          { label: 'Saldo',    shortLabel: 'SALDO',    colorClass: 'border-sky-500/40   bg-sky-500/10   data-[active=true]:border-sky-400   data-[active=true]:bg-sky-500/20'   },
  payroll_discount: { label: 'Planilla', shortLabel: 'PLANILLA', colorClass: 'border-violet-500/40 bg-violet-500/10 data-[active=true]:border-violet-400 data-[active=true]:bg-violet-500/20' },
  cash:             { label: 'Efectivo', shortLabel: 'EFECTIVO', colorClass: 'border-emerald-500/40 bg-emerald-500/10 data-[active=true]:border-emerald-400 data-[active=true]:bg-emerald-500/20' },
  free:             { label: 'Gratuito', shortLabel: 'GRATUITO', colorClass: 'border-ci-line      bg-ci-raised/50   data-[active=true]:border-ci-amber   data-[active=true]:bg-ci-amber/10' },
}

// ─────────────────────────────────────────────────────────────────────
// Sub-componente: Barra de porciones
// ─────────────────────────────────────────────────────────────────────
function PortionsBar({ menu }: { menu: MenuOfDay }) {
  const pct = menu.max_portions > 0
    ? Math.round((menu.served_portions / menu.max_portions) * 100)
    : 0
  const remaining = menu.max_portions - menu.served_portions

  const barColor = pct < 70
    ? 'bg-ci-success'
    : pct < 90
    ? 'bg-ci-warning'
    : 'bg-ci-error'

  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-mono text-[10px] tracking-[0.25em] text-ci-muted uppercase">Disponibilidad</span>
        <span className="font-mono text-xs text-ci-primary">
          {menu.served_portions}<span className="text-ci-muted">/{menu.max_portions}</span>
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="h-2 bg-ci-raised border border-ci-line overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className={`font-mono text-[10px] ${pct >= 90 ? 'text-ci-error' : 'text-ci-muted'}`}>
          {pct}% ocupado
        </span>
        <span className={`font-mono text-[10px] ${remaining === 0 ? 'text-ci-error' : 'text-ci-secondary'}`}>
          {remaining} restantes
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Sub-componente: Panel del menú del día
// ─────────────────────────────────────────────────────────────────────
function MenuPanel({ menu }: { menu: MenuOfDay }) {
  const DATE_LABEL = new Date(menu.service_date + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="border border-ci-line bg-ci-base h-full p-6 flex flex-col gap-5">
      {/* Header del menú */}
      <div>
        <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-1">Menú del día</p>
        <h2 className="font-display font-bold text-xl text-ci-primary">{menu.name}</h2>
        <p className="font-mono text-xs text-ci-muted capitalize mt-0.5">{DATE_LABEL}</p>
      </div>

      {/* Ítems del menú */}
      <ul className="space-y-2 flex-1">
        {menu.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <span className="font-mono text-[9px] tracking-widest text-ci-muted uppercase w-16 shrink-0">
              {item.category}
            </span>
            <div className="w-px h-3 bg-ci-line shrink-0" />
            <span className="text-sm text-ci-secondary font-body">{item.name}</span>
          </li>
        ))}
      </ul>

      <div className="h-px bg-ci-line" />

      {/* Contador de porciones */}
      <PortionsBar menu={menu} />

      <div className="h-px bg-ci-line" />

      {/* Precio + estado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${menu.is_active ? 'bg-ci-success animate-pulse' : 'bg-ci-error'}`} />
          <span className={`font-mono text-[10px] tracking-widest uppercase ${menu.is_active ? 'text-ci-success' : 'text-ci-error'}`}>
            {menu.is_active ? 'Menú activo' : 'Menú inactivo'}
          </span>
        </div>
        <span className="font-display font-bold text-lg text-ci-amber">
          ${menu.price.toLocaleString('es-CL')}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Sub-componente: Historial reciente
// ─────────────────────────────────────────────────────────────────────
function RecentLog({ entries }: { entries: RecentEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="border border-ci-line bg-ci-base p-4">
        <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-3">Historial de entregas</p>
        <p className="text-ci-muted text-sm font-body text-center py-2">Sin entregas aún.</p>
      </div>
    )
  }

  return (
    <div className="border border-ci-line bg-ci-base p-4">
      <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-3">
        Últimas entregas ({entries.length})
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-ci-muted text-[10px] tracking-widest uppercase border-b border-ci-line">
              <th className="text-left pb-2 pr-4">Hora</th>
              <th className="text-left pb-2 pr-4">Identificador</th>
              <th className="text-left pb-2 pr-4">Método</th>
              <th className="text-right pb-2 pr-4">Monto</th>
              <th className="text-center pb-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-ci-line/50 hover:bg-ci-raised/30 transition-colors"
                title={entry.errorMsg}
              >
                <td className="py-2 pr-4 text-ci-muted">
                  {entry.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="py-2 pr-4 text-ci-secondary">
                  <span className="text-[9px] text-ci-muted mr-1.5 uppercase">
                    {entry.identifierType}
                  </span>
                  {entry.identifier.length > 20
                    ? `${entry.identifier.slice(0, 12)}…`
                    : entry.identifier}
                </td>
                <td className="py-2 pr-4 text-ci-secondary uppercase tracking-wider text-[10px]">
                  {PAYMENT_CONFIG[entry.paymentMethod].shortLabel}
                </td>
                <td className="py-2 pr-4 text-right text-ci-secondary">
                  {entry.amount > 0 ? `$${entry.amount.toLocaleString('es-CL')}` : '—'}
                </td>
                <td className="py-2 text-center">
                  {entry.status === 'success' ? (
                    <span className="inline-flex items-center gap-1 text-ci-success">
                      <IconCheck /><span>OK</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-ci-error" title={entry.errorMsg}>
                      <IconX /><span>Error</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════
export default function POS() {
  const { user }   = useAuth()
  const clock      = useClock()
  const { menu, recentEntries, isSubmitting, notification, clearNotification, processDelivery } = usePOS()

  // Tab activo: 'qr' (escáner) | 'rut' (manual)
  const [activeTab, setActiveTab] = useState<'qr' | 'rut'>('qr')

  // Método de pago seleccionado
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('balance')

  // Refs para auto-focus
  const qrInputRef  = useRef<HTMLInputElement | null>(null)
  const rutInputRef = useRef<HTMLInputElement | null>(null)

  // ── Formulario QR ────────────────────────────────────────────────
  const qrForm = useForm<QRFormData>({
    resolver: zodResolver(qrSchema),
    defaultValues: { qr_token: '', payment_method: 'balance' },
  })

  // ── Formulario RUT ───────────────────────────────────────────────
  const rutForm = useForm<RUTFormData>({
    resolver: zodResolver(rutSchema),
    defaultValues: { user_rut: '', payment_method: 'balance' },
  })

  // ── Auto-focus al cambiar de tab ─────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'qr') qrInputRef.current?.focus()
      else                    rutInputRef.current?.focus()
    }, 80)
    return () => clearTimeout(timer)
  }, [activeTab, isSubmitting])

  // ── Re-focus tras submit exitoso ─────────────────────────────────
  useEffect(() => {
    if (!isSubmitting && notification?.type === 'success') {
      setTimeout(() => {
        if (activeTab === 'qr') qrInputRef.current?.focus()
        else                    rutInputRef.current?.focus()
      }, 100)
    }
  }, [isSubmitting, notification, activeTab])

  // ── Handler QR ───────────────────────────────────────────────────
  const onSubmitQR = qrForm.handleSubmit(async (data) => {
    const ok = await processDelivery({ type: 'qr', value: data.qr_token }, paymentMethod)
    if (ok) qrForm.reset()
  })

  // ── Handler RUT ──────────────────────────────────────────────────
  const onSubmitRUT = rutForm.handleSubmit(async (data) => {
    const ok = await processDelivery({ type: 'rut', value: data.user_rut }, paymentMethod)
    if (ok) rutForm.reset()
  })

  // El submit activo depende del tab
  const handleSubmit = activeTab === 'qr' ? onSubmitQR : onSubmitRUT
  const activeErrors = activeTab === 'qr' ? qrForm.formState.errors : rutForm.formState.errors
  const inputError   = activeTab === 'qr'
    ? (qrForm.formState.errors.qr_token?.message)
    : (rutForm.formState.errors.user_rut?.message)

  const noPortions = menu.served_portions >= menu.max_portions
  const isBlocked  = isSubmitting || !menu.is_active || noPortions

  return (
    <div className="min-h-screen bg-ci-void bg-grid">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-ci-line bg-ci-base/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border border-ci-amber/40 flex items-center justify-center">
            <span className="font-mono font-bold text-ci-amber text-[10px]">CI</span>
          </div>
          <div className="h-4 w-px bg-ci-line" />
          <span className="font-display font-bold text-base tracking-wider text-ci-primary uppercase">
            Punto de Venta
          </span>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <span className="hidden sm:block font-mono text-xs text-ci-muted">
              {user.role === 'admin' ? 'ADMIN' : 'OPERADOR'}
              <span className="text-ci-primary"> · {user.id.slice(0, 8).toUpperCase()}</span>
            </span>
          )}
          <span className="font-mono text-sm text-ci-amber tabular-nums">{clock}</span>
        </div>
      </header>

      {/* ── Contenido principal ─────────────────────────────────── */}
      <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">

        {/* Alerta: sin porciones */}
        {noPortions && (
          <div role="alert" className="border border-ci-error/30 bg-ci-error/5 p-3 flex items-center gap-2 animate-slide-up">
            <span className="text-ci-error">⚠</span>
            <p className="text-sm text-ci-error font-body">Este menú ya no tiene porciones disponibles.</p>
          </div>
        )}

        {/* Grid principal */}
        <div className="grid lg:grid-cols-[1fr,1.15fr] gap-4">

          {/* ═══════════════════════════════════════════════════
              PANEL IZQUIERDO — Resumen del menú
          ═══════════════════════════════════════════════════ */}
          <MenuPanel menu={menu} />

          {/* ═══════════════════════════════════════════════════
              PANEL DERECHO — Formulario de acción
          ═══════════════════════════════════════════════════ */}
          <div className="border border-ci-line bg-ci-base p-6 flex flex-col gap-5 relative">
            {/* Línea de acento superior */}
            <div
              aria-hidden
              className="absolute inset-x-6 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, rgba(245,158,11,0.35), transparent)' }}
            />

            {/* Título del panel */}
            <div>
              <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase">
                Registrar entrega
              </p>
            </div>

            {/* ── Tabs: QR / RUT ─────────────────────────────────── */}
            <div className="flex border border-ci-line overflow-hidden">
              {(['qr', 'rut'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  disabled={isSubmitting}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 py-2.5',
                    'font-mono text-xs tracking-widest uppercase transition-colors',
                    activeTab === tab
                      ? 'bg-ci-amber/10 text-ci-amber border-b-2 border-ci-amber'
                      : 'text-ci-muted hover:text-ci-secondary hover:bg-ci-raised/50',
                  ].join(' ')}
                >
                  {tab === 'qr' ? <IconQR /> : <IconID />}
                  {tab === 'qr' ? 'Escáner QR' : 'RUT manual'}
                </button>
              ))}
            </div>

            {/* ── Campo de entrada (QR o RUT) ──────────────────────── */}
            <div>
              {activeTab === 'qr' ? (
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-2">
                    Token QR del comensal
                  </label>
                  <input
                    {...qrForm.register('qr_token')}
                    ref={(el) => {
                      qrForm.register('qr_token').ref(el)
                      qrInputRef.current = el
                    }}
                    type="text"
                    disabled={isBlocked}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Escanee el código QR o péguelo aquí…"
                    onKeyDown={(e) => e.key === 'Enter' && onSubmitQR()}
                    className={`input-terminal ${qrForm.formState.errors.qr_token ? 'error' : ''}`}
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-2">
                    RUT del comensal
                  </label>
                  <input
                    {...rutForm.register('user_rut')}
                    ref={(el) => {
                      rutForm.register('user_rut').ref(el)
                      rutInputRef.current = el
                    }}
                    type="text"
                    disabled={isBlocked}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="12345678-9"
                    onKeyDown={(e) => e.key === 'Enter' && onSubmitRUT()}
                    className={`input-terminal ${rutForm.formState.errors.user_rut ? 'error' : ''}`}
                  />
                </div>
              )}

              {inputError && (
                <p className="mt-1.5 text-[11px] font-mono text-ci-error/80 animate-slide-up">
                  {inputError}
                </p>
              )}
            </div>

            {/* ── Selector de método de pago ───────────────────────── */}
            <div>
              <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-3">
                Método de pago
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const cfg = PAYMENT_CONFIG[method]
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      disabled={isSubmitting}
                      data-active={paymentMethod === method}
                      className={[
                        'py-2.5 px-3 border text-left transition-all',
                        'font-mono text-xs tracking-wider uppercase',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        cfg.colorClass,
                        paymentMethod === method ? 'text-ci-primary' : 'text-ci-muted',
                      ].join(' ')}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Notificación éxito / error ───────────────────────── */}
            {notification && (
              <div
                role="alert"
                aria-live="assertive"
                className={[
                  'flex items-start gap-2.5 p-3.5 border text-sm font-body animate-slide-up',
                  notification.type === 'success'
                    ? 'border-ci-success/25 bg-ci-success/5 text-ci-success'
                    : 'border-ci-error/25 bg-ci-error/5 text-ci-error',
                ].join(' ')}
              >
                {notification.type === 'success' ? <IconCheck /> : <IconX />}
                <span className="flex-1 text-xs leading-relaxed">{notification.message}</span>
                <button
                  type="button"
                  onClick={clearNotification}
                  className="text-current/50 hover:text-current transition-colors shrink-0"
                  aria-label="Cerrar notificación"
                >
                  <IconX />
                </button>
              </div>
            )}

            {/* ── Monto que se cobrará ─────────────────────────────── */}
            <div className="flex items-center justify-between py-2 border-t border-ci-line">
              <span className="font-mono text-xs text-ci-muted uppercase tracking-wider">Monto a cobrar</span>
              <span className="font-display font-bold text-xl text-ci-primary">
                {paymentMethod === 'free' ? (
                  <span className="text-ci-muted text-sm">Gratuito</span>
                ) : (
                  `$${menu.price.toLocaleString('es-CL')}`
                )}
              </span>
            </div>

            {/* ── Botón de submit ──────────────────────────────────── */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isBlocked}
              aria-busy={isSubmitting}
              aria-live="polite"
              className={[
                'w-full flex items-center justify-center gap-2.5 py-4',
                'font-display font-bold text-sm tracking-[0.22em] uppercase',
                'transition-all duration-200 relative overflow-hidden group',
                isBlocked
                  ? 'bg-ci-amber/40 text-ci-void/60 cursor-not-allowed'
                  : 'bg-ci-amber text-ci-void hover:bg-ci-amber-bright active:scale-[0.99]',
              ].join(' ')}
            >
              {/* Efecto barrido en hover */}
              {!isBlocked && (
                <span
                  aria-hidden
                  className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-500 skew-x-12"
                />
              )}

              {isSubmitting ? (
                <>
                  <IconSpinner />
                  Procesando…
                </>
              ) : noPortions ? (
                'Sin porciones disponibles'
              ) : !menu.is_active ? (
                'Menú inactivo'
              ) : (
                <>
                  Confirmar entrega →
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Historial reciente ───────────────────────────────── */}
        <RecentLog entries={recentEntries} />
      </div>
    </div>
  )
}
