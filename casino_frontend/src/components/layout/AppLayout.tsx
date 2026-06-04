import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AppHeader from './AppHeader'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-ci-void flex flex-col">
      {/* Header fijo arriba */}
      <AppHeader sidebarCollapsed={collapsed} />

      {/* Sidebar + contenido */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(prev => !prev)}
        />

        {/* Área de contenido */}
        <main className="flex-1 overflow-auto bg-ci-void">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
