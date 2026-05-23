import { Cross2Icon, ExitIcon, MoonIcon, PersonIcon, SunIcon } from '@radix-ui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthUser } from '@ama-midi/shared'
import { apiClient } from '../../features/auth/api'
import { DEPARTMENTS } from '../../features/profile/constants'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/auth.store'
import { useThemeStore } from '../../store/theme.store'
import { AmanotesIcon } from '../AmanotesLogo'
import { Avatar, Button, IconButton, Input } from '../ui'

export interface AppShellProps {
  children: React.ReactNode
  maxWidth?: string
  showHeader?: boolean
  className?: string
}

export function AppShell({ children, maxWidth = '1100px', showHeader = true, className }: AppShellProps) {
  const { user, token, setAuth, clearAuth } = useAuthStore()
  const { resolved: theme, setMode: setTheme } = useThemeStore()
  const navigate = useNavigate()
  const [accountOpen, setAccountOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState(user?.name ?? '')
  const [profileTitle, setProfileTitle] = useState(user?.title ?? '')
  const [profileDepartment, setProfileDepartment] = useState(user?.department ?? '')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false)
    }

    if (accountOpen) document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [accountOpen])

  function handleSignOut() {
    setAccountOpen(false)
    clearAuth()
    navigate('/login')
  }

  function handleProfileClick() {
    setAccountOpen(false)
    setProfileName(user?.name ?? '')
    setProfileTitle(user?.title ?? '')
    setProfileDepartment(user?.department ?? '')
    setProfileError('')
    setProfileOpen(true)
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profileTitle.trim())  { setProfileError('Title is required'); return }
    if (!profileDepartment)    { setProfileError('Department is required'); return }

    setProfileLoading(true)
    setProfileError('')
    try {
      const updated = await apiClient(token)<AuthUser>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileName.trim() || undefined,
          title: profileTitle.trim(),
          department: profileDepartment,
          profileComplete: true,
        }),
      })
      setAuth(updated, token!)
      setProfileOpen(false)
    } catch {
      setProfileError('Failed to save profile. Please try again.')
    } finally {
      setProfileLoading(false)
    }
  }

  return (
    <div className={cn('min-h-screen bg-shell-bg', className)}>
      {showHeader && (
        <header className="h-16 border-b border-shell-border bg-shell-surface flex items-center px-6">
          <div className="flex items-center gap-2">
            <AmanotesIcon className="w-7 h-7 shrink-0" />
            <span className="font-semibold text-shell-text">AMA-MIDI</span>
          </div>
          {user && (
            <div className="ml-auto flex items-center gap-2">
              <IconButton
                size="sm"
                tooltip={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </IconButton>

              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label="Open account menu"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((open) => !open)}
                >
                  <Avatar src={user.avatarUrl} name={user.name} size="sm" />
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-11 z-50 w-72 rounded-lg border border-shell-border bg-shell-surface p-3 shadow-lg"
                  >
                    <div className="flex items-center gap-3 border-b border-shell-border pb-3">
                      <Avatar src={user.avatarUrl} name={user.name} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-shell-text">{user.name}</p>
                        <p className="truncate text-xs text-shell-muted">{user.email}</p>
                        {(user.title || user.department) && (
                          <p className="mt-0.5 truncate text-xs text-shell-tertiary">
                            {[user.title, user.department].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleProfileClick}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-shell-text transition-colors hover:bg-shell-bg"
                      >
                        <PersonIcon aria-hidden="true" />
                        <span>User Profile</span>
                      </button>

                      <Button
                        type="button"
                        role="menuitem"
                        variant="danger"
                        size="sm"
                        icon={<ExitIcon aria-hidden="true" />}
                        onClick={handleSignOut}
                        className="w-full justify-start"
                      >
                        Sign out
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>
      )}

      {user && profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="presentation">
          <form
            onSubmit={handleProfileSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-popup-title"
            className="w-full max-w-sm rounded-lg border border-shell-border bg-shell-surface p-5 shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar src={user.avatarUrl} name={user.name} size="lg" />
                <div className="min-w-0">
                  <h2 id="profile-popup-title" className="truncate text-base font-semibold text-shell-text">
                    {user.name}
                  </h2>
                  <p className="truncate text-sm text-shell-muted">{user.email}</p>
                </div>
              </div>
              <IconButton type="button" size="sm" tooltip="Close profile" onClick={() => setProfileOpen(false)}>
                <Cross2Icon />
              </IconButton>
            </div>

            <div className="mb-4 rounded-lg border border-shell-border bg-shell-bg p-3">
              <p className="text-xs font-medium text-shell-text">Google account</p>
              <p className="mt-0.5 text-xs text-shell-muted">Avatar and email are synced from Google.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-shell-muted">Display Name</label>
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-shell-muted">
                  Title <span className="text-error">*</span>
                </label>
                <Input
                  value={profileTitle}
                  onChange={(e) => setProfileTitle(e.target.value)}
                  placeholder="e.g. Sound Designer, Game Developer, QA Engineer"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-shell-muted">
                  Department <span className="text-error">*</span>
                </label>
                <select
                  value={profileDepartment}
                  onChange={(e) => setProfileDepartment(e.target.value)}
                  className="w-full rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </div>

              {profileError && <p className="text-xs text-error">{profileError}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setProfileOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={profileLoading}>
                Save profile
              </Button>
            </div>
          </form>
        </div>
      )}

      <main className="mx-auto px-4 py-8" style={{ maxWidth }}>
        {children}
      </main>
    </div>
  )
}
