import { useAuth } from '@/hooks/useAuth'
import NavItem from './NavItem'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const NAV_ITEMS = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard', roles: ['admin', 'operator'] },
  { to: '/menus',     icon: '🍽',  label: 'Menús',     roles: ['admin', 'operator'] },
  { to: '/pos',       icon: '💳', label: 'POS',        roles: ['admin', 'operator'] },
  { to: '/reports',   icon: '📈', label: 'Reportes',   roles: ['admin'] },
] as const

const ROLE_LABEL: Record<string, string> = {
  admin:    'Administrador',
  operator: 'Operador',
  diner:    'Comensal',
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth()

  const visibleItems = NAV_ITEMS.filter(
    item => user && (item.roles as readonly string[]).includes(user.role)
  )

  const initial   = user?.role?.[0]?.toUpperCase() ?? '?'
  const roleLabel = user ? (ROLE_LABEL[user.role] ?? user.role) : ''

  return (
    <aside
      className={[
        'flex flex-col bg-ci-base border-r border-ci-line shrink-0',
        'transition-all duration-300',
        collapsed ? 'w-10' : 'w-36',
      ].join(' ')}
    >
      {/* Toggle button */}
      <div className={['flex py-2 px-1', collapsed ? 'justify-center' : 'justify-end'].join(' ')}>
        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="w-6 h-6 flex items-center justify-center border border-ci-line rounded-sm text-ci-muted hover:text-ci-amber hover:border-ci-amber/40 transition-colors font-mono text-xs"
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-1 flex-1">
        {visibleItems.map(item => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-ci-line px-1 py-2 flex flex-col gap-1">
        <div className={['flex items-center gap-2 px-1 py-1', collapsed ? 'justify-center' : ''].join(' ')}>
          <div className="w-5 h-5 rounded-full bg-ci-amber/15 border border-ci-amber/40 flex items-center justify-center shrink-0">
            <span className="font-mono text-ci-amber text-[9px] font-bold">{initial}</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-ci-primary font-mono text-[10px] truncate capitalize">{user?.role}</p>
              <p className="text-ci-muted font-mono text-[8px] tracking-widest uppercase truncate">{roleLabel}</p>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          title="Cerrar sesión"
          className={[
            'flex items-center gap-2 px-2 py-1.5 rounded-sm text-ci-secondary hover:text-ci-error',
            'hover:bg-ci-error/5 transition-colors font-mono text-[10px] uppercase tracking-wide',
            collapsed ? 'justify-center' : '',
          ].join(' ')}
        >
          <span className="text-sm leading-none">⎋</span>
          {!collapsed && <span>Salir</span>}
        </button>
      </div>
    </aside>
  )
}
