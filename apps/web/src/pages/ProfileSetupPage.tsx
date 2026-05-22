import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Avatar } from '../components/ui'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../features/auth/api'
import type { AuthUser } from '@ama-midi/shared'

const DEPARTMENTS = ['Core Music', 'Game Dev', 'QA', 'Product', 'Other']

export function ProfileSetupPage() {
  const { user, token, setAuth } = useAuthStore()
  const navigate = useNavigate()

  const [name,       setName]       = useState(user?.name ?? '')
  const [title,      setTitle]      = useState('')
  const [department, setDepartment] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim())  { setError('Title is required'); return }
    if (!department)    { setError('Department is required'); return }

    setLoading(true)
    setError('')
    try {
      const updated = await apiClient(token)<AuthUser>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name:           name.trim() || undefined,
          title:          title.trim(),
          department,
          profileComplete: true,
        }),
      })
      setAuth(updated, token!)
      navigate('/')
    } catch {
      setError('Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-shell-bg flex items-center justify-center p-4">
      <div className="bg-shell-surface rounded-2xl shadow-lg p-8 w-full max-w-md border border-shell-border">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amanotes-pink to-amanotes-purple shrink-0" />
          <div>
            <h1 className="text-base font-semibold text-shell-text">Complete your profile</h1>
            <p className="text-xs text-shell-muted">This helps your team know who you are</p>
          </div>
        </div>

        {/* Google avatar preview */}
        <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-shell-bg border border-shell-border">
          <Avatar name={user?.name ?? 'U'} src={user?.avatarUrl} size="md" />
          <div>
            <p className="text-sm font-medium text-shell-text">{user?.email}</p>
            <p className="text-xs text-shell-muted">Synced from Google</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-shell-muted mb-1">Display Name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-xs text-shell-muted mb-1">
              Title <span className="text-error">*</span>
            </label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Sound Designer, Game Developer, QA Engineer"
            />
          </div>

          <div>
            <label className="block text-xs text-shell-muted mb-1">
              Department <span className="text-error">*</span>
            </label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-shell-surface text-shell-text border-shell-border focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select department…</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            className="mt-2"
          >
            Enter AMA-MIDI →
          </Button>
        </form>
      </div>
    </div>
  )
}
