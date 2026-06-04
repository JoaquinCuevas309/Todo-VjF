interface AppHeaderProps {
  sidebarCollapsed: boolean
}

export default function AppHeader({ sidebarCollapsed }: AppHeaderProps) {
  return (
    <header className="h-10 bg-ci-base border-b border-ci-line flex items-center justify-between px-4 shrink-0 z-10">
      {/* Logo + nombre */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 border border-ci-amber flex items-center justify-center shrink-0">
          <span className="font-display font-black text-ci-amber text-xs tracking-widest">
            CI
          </span>
        </div>
        {!sidebarCollapsed && (
          <span className="font-mono text-[9px] tracking-[3px] text-ci-secondary uppercase hidden sm:block">
            Casino Institucional
          </span>
        )}
      </div>

      {/* Estado online + versión */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-ci-success shrink-0" />
        <span className="font-mono text-[9px] text-ci-secondary hidden sm:block">
          Sistema en línea
        </span>
        <span className="font-mono text-[9px] text-ci-muted ml-2">V1.0.0</span>
      </div>
    </header>
  )
}
