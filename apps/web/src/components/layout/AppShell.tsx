import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/auth.store'
import { Avatar } from '../ui/Avatar'

export interface AppShellProps {
  children: React.ReactNode
  maxWidth?: string
  showHeader?: boolean
  className?: string
}

export function AppShell({ children, maxWidth = '1100px', showHeader = true, className }: AppShellProps) {
  const user      = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return (
    <div className={cn('min-h-screen bg-shell-bg', className)}>
      {showHeader && (
        <header className="h-16 border-b border-shell-border bg-shell-surface flex items-center px-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amanotes-pink to-amanotes-purple" />
            <span className="font-semibold text-shell-text">AMA-MIDI</span>
          </div>
          {user && (
            <div className="ml-auto flex items-center gap-3">
              <Avatar src={user.avatarUrl} name={user.name} size="sm" />
              <button onClick={clearAuth} className="text-xs text-shell-muted hover:text-shell-text">
                Sign out
              </button>
            </div>
          )}
        </header>
      )}
      <main className="mx-auto px-4 py-8" style={{ maxWidth }}>
        {children}
      </main>
    </div>
  )
}
