import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { AuthUser } from '@ama-midi/shared'
import { AmanotesIcon } from '../../components/AmanotesLogo'
import { Avatar, Button, Input } from '../../components/ui'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import { DEPARTMENTS } from '../profile/constants'
import { requestProductTour } from './product-tour.store'
import { OnboardingVisualCanvas } from './OnboardingVisualCanvas'
import {
  getNextOnboardingStep,
  getPreviousOnboardingStep,
  ONBOARDING_STEP_IDS,
  ONBOARDING_STEPS,
  onboardingPath,
  parseOnboardingStep,
  type OnboardingStepId,
} from './onboarding-flow'

function StepDots({ step }: { step: OnboardingStepId }) {
  const current = ONBOARDING_STEP_IDS.indexOf(step)
  return (
    <div className="flex items-center gap-2" aria-label={`Onboarding step ${current + 1} of ${ONBOARDING_STEP_IDS.length}`}>
      {ONBOARDING_STEP_IDS.map((id, index) => (
        <span
          key={id}
          className={index <= current ? 'h-1.5 w-8 rounded-full bg-primary' : 'h-1.5 w-8 rounded-full bg-shell-border'}
        />
      ))}
    </div>
  )
}

function ProfileForm({ onSaved }: { onSaved: () => void }) {
  const { user, token, setAuth } = useAuthStore()
  const [name, setName] = useState(user?.name ?? '')
  const [title, setTitle] = useState(user?.title ?? '')
  const [department, setDepartment] = useState(user?.department ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    if (!department) { setError('Department is required'); return }
    if (!token) { setError('Your session expired. Please sign in again.'); return }

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
      setAuth(updated, token)
      onSaved()
    } catch {
      setError('Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 max-w-xl space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-shell-border bg-shell-surface/70 p-3">
        <Avatar name={user?.name ?? 'U'} src={user?.avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-shell-text">{user?.email}</p>
          <p className="text-xs text-shell-muted">Synced from Google</p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-shell-muted">Display Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-shell-muted">
          Title <span className="text-error">*</span>
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Sound Designer, Game Developer, QA Engineer"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-shell-muted">
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

      <Button type="submit" variant="primary" size="lg" loading={loading}>
        Save & continue
      </Button>
    </form>
  )
}

export function OnboardingFlowPage() {
  const { step: rawStep } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const step = parseOnboardingStep(rawStep)
  const definition = ONBOARDING_STEPS[step]
  const next = getNextOnboardingStep(step)
  const previous = getPreviousOnboardingStep(step)

  useEffect(() => {
    if (rawStep !== step) {
      navigate(onboardingPath(step), { replace: true })
    }
  }, [navigate, rawStep, step])

  if (step === 'ready' && !user?.profileComplete) {
    return <Navigate to={onboardingPath('profile')} replace />
  }

  function goNext() {
    if (next) navigate(onboardingPath(next))
  }

  function goBack() {
    if (previous) navigate(onboardingPath(previous))
  }

  function takeTour() {
    requestProductTour({ force: true })
    navigate('/')
  }

  return (
    <main className="min-h-screen overflow-hidden bg-shell-bg text-shell-text">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,49,119,0.12),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.12),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AmanotesIcon className="h-9 w-9 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-shell-text">AMA-MIDI</p>
              <p className="text-xs text-shell-muted">Team chart production</p>
            </div>
          </div>
          <StepDots step={step} />
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:py-12">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{definition.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-shell-text sm:text-5xl">
              {definition.title}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-shell-muted">
              {definition.body}
            </p>

            <ul className="mt-7 grid gap-3">
              {definition.bullets.map((bullet, index) => (
                <li key={bullet} className="flex gap-3 text-sm text-shell-text">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="leading-6">{bullet}</span>
                </li>
              ))}
            </ul>

            {step === 'profile' ? (
              <ProfileForm onSaved={() => navigate(onboardingPath('ready'))} />
            ) : step === 'ready' ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="primary" size="lg" onClick={takeTour}>Take a tour</Button>
                <Button variant="secondary" size="lg" onClick={() => navigate('/')}>Go to dashboard</Button>
              </div>
            ) : (
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="primary" size="lg" onClick={goNext}>{definition.cta}</Button>
                {previous && <Button variant="ghost" size="lg" onClick={goBack}>Back</Button>}
              </div>
            )}
          </div>

          <div className="h-[360px] overflow-hidden rounded-lg border border-shell-border bg-shell-surface/70 p-3 shadow-xl shadow-black/20 sm:h-[440px] lg:h-[560px]">
            <OnboardingVisualCanvas step={step} />
          </div>
        </section>
      </div>
    </main>
  )
}
