/**
 * Dashboard.tsx — Vista principal del comensal (tab "Inicio").
 *
 * Contiene:
 *  1. Saludo personalizado con hora del día
 *  2. Tarjeta QR del comensal — hero element de la pantalla
 *  3. Menú del día
 *
 * Decisiones de diseño:
 *  • El QR SIEMPRE tiene fondo blanco (#FFFFFF) y QR negro (#000000).
 *    Esto es no negociable: los escáneres láser requieren alto contraste.
 *  • El valor del QR es el user.id (UUID del JWT). El POS lo envía como
 *    `user_id` al backend. No se incluye información sensible en el QR.
 *  • Glow ambar alrededor del QR para que sea el foco visual inmediato.
 */

import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '@/hooks/useAuth'
import { useDinerMenu, useGreeting } from '../hooks/useDinerData'
import { SkeletonQR, SkeletonMenu } from './Skeletons'
import type { DinerMenu } from '../types'

// ── Config de colores por categoría ──────────────────────────────
const CATEGORY_STYLE: Record<string, string> = {
  entrada:  'text-sky-400',
  fondo:    'text-ci-primary',
  ensalada: 'text-emerald-400',
  postre:   'text-ci-amber',
  bebida:   'text-violet-400',
  otro:     'text-ci-muted',
}

// ── Sub-componente: Tarjeta del menú ─────────────────────────────
function MenuCard({ menu }: { menu: DinerMenu }) {
  const pct = menu.max_portions > 0
    ? Math.round((menu.served_portions / menu.max_portions) * 100)
    : 0
  const remaining = menu.max_portions - menu.served_portions
  const DATE_LABEL = new Date(menu.service_date + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="border border-ci-line bg-ci-base overflow-hidden animate-fade-in">
      {/* Header de la tarjeta */}
      <div className="bg-ci-raised/60 px-5 py-4 border-b border-ci-line">
        <p className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase">Menú de hoy</p>
        <h2 className="font-display font-bold text-lg text-ci-primary mt-0.5">{menu.name}</h2>
        <p className="font-mono text-xs text-ci-muted capitalize">{DATE_LABEL}</p>
      </div>

      {/* Ítems */}
      <ul className="px-5 py-4 space-y-3">
        {menu.items.map((item, i) => (
          <li key={i} className="flex items-center gap-3">
            <span
              className={`font-mono text-[9px] tracking-widest uppercase w-16 shrink-0 ${CATEGORY_STYLE[item.category] ?? 'text-ci-muted'}`}
            >
              {item.category}
            </span>
            <div className="w-px h-3 bg-ci-line shrink-0" />
            <span className="text-sm text-ci-secondary font-body">{item.name}</span>
          </li>
        ))}
      </ul>

      {/* Footer: disponibilidad + precio */}
      <div className="border-t border-ci-line px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Barra de disponibilidad compacta */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-ci-raised overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ${
                  pct < 70 ? 'bg-ci-success' : pct < 90 ? 'bg-ci-warning' : 'bg-ci-error'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-ci-muted whitespace-nowrap shrink-0">
              {remaining > 0 ? `${remaining} disponibles` : 'Sin porciones'}
            </span>
          </div>
        </div>
        <span className="font-display font-bold text-base text-ci-amber shrink-0">
          ${menu.price.toLocaleString('es-CL')}
        </span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { user } = useAuth()
  const greeting = useGreeting()
  const { menu, isLoading } = useDinerMenu()

  return (
    <div className="flex-1 px-4 pt-5 pb-4 space-y-6 animate-fade-in">

      {/* ── Saludo ─────────────────────────────────────────────── */}
      <div>
        <p className="font-mono text-[10px] tracking-[0.3em] text-ci-muted uppercase">
          {greeting}
        </p>
        <p className="font-body text-ci-secondary text-sm mt-0.5">
          Tu código de acceso de hoy
        </p>
      </div>

      {/* ── Tarjeta QR — hero element ────────────────────────────
          FONDO BLANCO OBLIGATORIO para compatibilidad con escáneres.
          El valor del QR es el UUID del usuario extraído del JWT.
      ─────────────────────────────────────────────────────────── */}
      {user ? (
        <div className="flex flex-col items-center">
          {/* Contenedor con glow ambar — atrae la vista del cajero */}
          <div
            className="relative"
            style={{
              filter: 'drop-shadow(0 0 20px rgba(245,158,11,0.25))',
            }}
          >
            {/* Marco ambar alrededor del QR */}
            <div className="p-[3px] bg-gradient-to-br from-ci-amber/60 via-ci-amber/30 to-ci-amber/10">
              {/* Fondo blanco — NO cambiar bajo ninguna circunstancia */}
              <div className="bg-white p-4">
                <QRCodeSVG
                  value={user.id}
                  size={220}
                  level="H"         // Máxima corrección de errores (30% del código puede ocultarse)
                  bgColor="#FFFFFF" // Fondo: blanco puro
                  fgColor="#000000" // QR: negro puro (máximo contraste)
                  marginSize={1}
                  aria-label={`Código QR de acceso — ID: ${user.id.slice(0, 8)}`}
                />
              </div>
            </div>

            {/* Pulso decorativo (no interfiere con el escaneo) */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-20 animate-ping"
              style={{
                background: 'radial-gradient(ellipse, rgba(245,158,11,0.4) 0%, transparent 70%)',
                animationDuration: '3s',
              }}
            />
          </div>

          {/* Instrucción para el comensal */}
          <div className="mt-4 text-center">
            <p className="font-body text-sm text-ci-secondary">
              Muestra este código al cajero
            </p>
            <p className="font-mono text-[10px] text-ci-muted mt-1 tracking-wider">
              ID: {user.id.slice(0, 8).toUpperCase()}…
            </p>
          </div>
        </div>
      ) : (
        <SkeletonQR />
      )}

      {/* ── Menú del día ─────────────────────────────────────────── */}
      {isLoading ? (
        <SkeletonMenu />
      ) : menu ? (
        <MenuCard menu={menu} />
      ) : (
        <div className="border border-ci-line bg-ci-base p-6 text-center">
          <p className="text-ci-muted text-sm font-body">
            No hay menú disponible para hoy.
          </p>
        </div>
      )}

    </div>
  )
}
