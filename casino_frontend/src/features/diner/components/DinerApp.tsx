/**
 * DinerApp.tsx — Shell de la PWA para comensales.
 *
 * Estructura:
 *  • Header fijo en la parte superior (logo + nombre del app)
 *  • Área de contenido con scroll (Dashboard o History)
 *  • Bottom Navigation Bar fija con "safe-area-inset-bottom"
 *    para que no quede oculta bajo la barra de gestos en Android/iOS.
 *
 * Tabs:
 *  inicio    → Dashboard (QR + menú del día)
 *  historial → History (consumos)
 */

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Dashboard from './Dashboard'
import History   from './History'

type Tab = 'inicio' | 'historial'

// ── Iconos de la barra inferior ──────────────────────────────────
const IconHome = ({ active }: { active: boolean }) => (
  <svg
    className={`w-5 h-5 transition-colors ${active ? 'text-ci-amber' : 'text-ci-muted'}`}
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={active ? 0 : 1.75}
    aria-hidden
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const IconHistory = ({ active }: { active: boolean }) => (
  <svg
    className={`w-5 h-5 transition-colors ${active ? 'text-ci-amber' : 'text-ci-muted'}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={active ? 2 : 1.75}
    aria-hidden
  >
    <polyline points="12 8 12 12 14 14" />
    <path d="M3.05 11a9 9 0 108.94-7 9 9 0 00-8.94 7z" />
    {active && <circle cx="12" cy="12" r="1" fill="currentColor" />}
  </svg>
)

const IconLogout = () => (
  <svg
    className="w-4 h-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden
  >
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

// ═════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════
export default function DinerApp() {
  const [activeTab, setActiveTab] = useState<Tab>('inicio')
  const { logout }                = useAuth()

  const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ active: boolean }> }[] = [
    { id: 'inicio',    label: 'Inicio',    Icon: IconHome    },
    { id: 'historial', label: 'Historial', Icon: IconHistory },
  ]

  return (
    <div className="min-h-screen bg-ci-void flex flex-col max-w-md mx-auto relative">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-ci-line bg-ci-base/95 backdrop-blur-sm px-4 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 border border-ci-amber/40 flex items-center justify-center bg-ci-amber/8"
            style={{ clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)' }}
            aria-hidden
          >
            <span className="font-mono font-bold text-ci-amber text-[9px]">CI</span>
          </div>
          <span className="font-display font-bold text-sm tracking-wider text-ci-primary uppercase">
            Casino Institucional
          </span>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-ci-muted hover:text-ci-error transition-colors py-1.5 px-2"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <IconLogout />
          <span className="font-mono text-[10px] tracking-wider uppercase hidden sm:block">
            Salir
          </span>
        </button>
      </header>

      {/* ── Área de contenido scrollable ─────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto flex flex-col"
        // Padding inferior para que el contenido no quede bajo la nav
        style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        role="main"
        aria-label={activeTab === 'inicio' ? 'Inicio' : 'Historial de consumos'}
      >
        {activeTab === 'inicio'    && <Dashboard />}
        {activeTab === 'historial' && <History   />}
      </main>

      {/* ── Bottom Navigation Bar ────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto border-t border-ci-line bg-ci-base/97 backdrop-blur-sm z-20 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navegación principal"
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              className={[
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 relative',
                'transition-colors duration-150',
                isActive ? 'text-ci-amber' : 'text-ci-muted hover:text-ci-secondary',
              ].join(' ')}
            >
              {/* Indicador activo — línea superior */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-ci-amber"
                  style={{ borderRadius: '0 0 2px 2px' }}
                />
              )}
              <Icon active={isActive} />
              <span className="font-mono text-[9px] tracking-widest uppercase">
                {label}
              </span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}
