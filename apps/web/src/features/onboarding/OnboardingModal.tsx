import { useState } from 'react'
import { Button, Input, Avatar } from '../../components/ui'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import { DEPARTMENTS } from '../profile/constants'
import type { AuthUser } from '@ama-midi/shared'
import { AmanotesIcon } from '../../components/AmanotesLogo'

interface Props {
  onComplete: () => void
}

const VALUE_CARDS = [
  {
    icon: '🎹',
    title: 'Piano Roll',
    body: '8 tracks × 300s of musical timeline, fast note placement',
  },
  {
    icon: '👥',
    title: 'Real-time Collaboration',
    body: 'Live cursors, instant sync across all team members',
  },
  {
    icon: '✨',
    title: 'AI Suggestions',
    body: 'Generate full charts or fill track gaps with AI',
  },
] as const

export function OnboardingModal({ onComplete }: Props) {
  const { user, token, setAuth } = useAuthStore()
  const [step, setStep] = useState<0 | 1>(0)
  const [name, setName] = useState(user?.name ?? '')
  const [title, setTitle] = useState(user?.title ?? '')
  const [department, setDepartment] = useState(user?.department ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    if (!department) { setError('Department is required'); return }

    setLoading(true)
    setError('')
    try {
      const updated = await apiClient(token)<AuthUser>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim() || undefined,
          title: title.trim(),
          department,
          profileComplete: true,
        }),
      })
      setAuth(updated, token!)
      onComplete()
    } catch {
      setError('Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-shell-border bg-shell-surface p-6 shadow-xl">
        {step === 0 ? (
          <div>
            <div className="mb-5 flex items-center gap-2">
              <AmanotesIcon className="h-8 w-8 shrink-0" />
              <div>
                <h1 className="text-lg font-semibold text-shell-text">Welcome to AMA-MIDI</h1>
                <p className="text-sm text-shell-muted">The collaborative MIDI editor for game audio teams</p>
              </div>
            </div>

            <div className="space-y-2">
              {VALUE_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="flex gap-3 rounded-lg border border-shell-border bg-shell-bg/60 px-3 py-2.5"
                >
                  <span className="text-lg" aria-hidden>{card.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-shell-text">{card.title}</p>
                    <p className="text-xs text-shell-muted">{card.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={() => setStep(1)}>
                Get started →
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleProfileSubmit}>
            <h2 className="text-base font-semibold text-shell-text">Complete your profile</h2>
            <p className="mt-1 text-sm text-shell-muted">This helps your team know who you are</p>

            <div className="mt-4 flex items-center gap-3 rounded-lg border border-shell-border bg-shell-bg/60 p-3">
              <Avatar name={user?.name ?? 'U'} src={user?.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-shell-text">{user?.email}</p>
                <p className="text-xs text-shell-muted">Synced from Google</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-shell-muted">Display Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-shell-muted">
                  Title <span className="text-error">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sound Designer, Game Developer"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-shell-muted">
                  Department <span className="text-error">*</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" variant="primary" loading={loading}>
                Save & continue →
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 flex justify-center gap-2">
          <span className={step === 0 ? 'h-2 w-2 rounded-full bg-primary' : 'h-2 w-2 rounded-full bg-shell-border'} />
          <span className={step === 1 ? 'h-2 w-2 rounded-full bg-primary' : 'h-2 w-2 rounded-full bg-shell-border'} />
        </div>
      </div>
    </div>
  )
}
