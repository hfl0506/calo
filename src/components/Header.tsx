import { authClient } from '#/lib/auth-client'
import ThemeToggle from './ThemeToggle'

type User = { name: string; email: string; image?: string | null }

export default function Header({ user }: { user: User }) {
  const initial = user.name?.charAt(0).toUpperCase() || 'U'

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <div className="flex h-14 items-center justify-between gap-3">
        <span className="text-base font-semibold text-[var(--sea-ink)]">Calo</span>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(79,184,178,0.18)] text-xs font-semibold text-[var(--lagoon-deep)]">
              {initial}
            </div>
            <button
              onClick={() => void authClient.signOut()}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
