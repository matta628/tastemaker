import { Link, useLocation } from 'react-router-dom'
import { AnalyticsChat } from './AnalyticsChat'
import { useUIStore } from '../../store/uiStore'

const PAGES = [
  { path: '/dashboard',   label: 'Dashboard'   },
  { path: '/explore',     label: 'Deep Dive'   },
  { path: '/discover',    label: 'Discover'    },
  { path: '/timemachine', label: 'Time Machine' },
]

export function AnalyticsShell({ children }) {
  const { pathname } = useLocation()
  const { chatPanelOpen } = useUIStore()

  return (
    <div className="h-svh overflow-hidden bg-zinc-950 flex flex-col">
      {/* Top nav */}
      <header className="shrink-0 flex items-center gap-4 px-6 py-3 border-b border-zinc-800 bg-zinc-950">
        <Link to="/" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
          ← Guitar
        </Link>
        <span className="text-zinc-700">|</span>
        <nav className="flex gap-1">
          {PAGES.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === path || pathname.startsWith(path + '/')
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Page content — shrinks when chat panel is open */}
      <div className={`flex-1 overflow-hidden transition-all duration-200 ${chatPanelOpen ? 'mr-[360px]' : ''}`}>
        {children}
      </div>

      {/* Collapsible chat panel */}
      <AnalyticsChat />
    </div>
  )
}
