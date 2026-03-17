import { Link, useMatches } from '@tanstack/react-router'
import { Home, History, Settings } from 'lucide-react'

export default function BottomNav() {
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.fullPath ?? '/'

  const isHome = currentPath === '/'
  const isHistory = currentPath.startsWith('/history')
  const isSettings = currentPath === '/settings'

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--line)] bg-[var(--header-bg)] backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-around">
        {/* Home */}
        <Link
          to="/"
          className={`flex flex-col items-center gap-0.5 px-6 py-1 transition ${
            isHome
              ? 'text-[var(--lagoon-deep)]'
              : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
          }`}
          aria-label="Home"
          aria-current={isHome ? 'page' : undefined}
        >
          <Home size={22} />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        {/* History */}
        <Link
          to="/history"
          className={`flex flex-col items-center gap-0.5 px-6 py-1 transition ${
            isHistory
              ? 'text-[var(--lagoon-deep)]'
              : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
          }`}
          aria-label="History"
          aria-current={isHistory ? 'page' : undefined}
        >
          <History size={22} />
          <span className="text-[10px] font-medium">History</span>
        </Link>

        {/* Settings */}
        <Link
          to="/settings"
          className={`flex flex-col items-center gap-0.5 px-6 py-1 transition ${
            isSettings
              ? 'text-[var(--lagoon-deep)]'
              : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
          }`}
          aria-label="Settings"
          aria-current={isSettings ? 'page' : undefined}
        >
          <Settings size={22} />
          <span className="text-[10px] font-medium">Settings</span>
        </Link>
      </div>

      {/* Safe area for devices with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
