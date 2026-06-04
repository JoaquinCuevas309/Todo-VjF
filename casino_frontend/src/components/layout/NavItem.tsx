import { NavLink } from 'react-router-dom'

interface NavItemProps {
  to: string
  icon: string
  label: string
  collapsed: boolean
}

export default function NavItem({ to, icon, label, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-2 py-2 rounded-r-sm text-xs font-mono transition-colors duration-150',
          'border-l-2',
          isActive
            ? 'border-ci-amber bg-ci-amber/10 text-ci-amber'
            : 'border-transparent text-ci-secondary hover:text-ci-primary hover:bg-ci-overlay',
          collapsed ? 'justify-center px-0' : '',
        ].join(' ')
      }
    >
      <span className="text-base leading-none shrink-0">{icon}</span>
      {!collapsed && (
        <span className="truncate tracking-wide uppercase text-[10px]">
          {label}
        </span>
      )}
    </NavLink>
  )
}
