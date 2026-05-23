import { useState, useEffect } from 'react'
import { AppShell } from '../components/layout'
import { Button, Input } from '../components/ui'
import { SongGrid } from '../features/songs/SongGrid'
import { useSongs, useCreateSong } from '../features/songs/useSongs'
import { useAppTour }  from '../features/onboarding/useAppTour'
import { TourOverlay } from '../features/onboarding/TourOverlay'
import { useAuthStore } from '../store/auth.store'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function SongListPage() {
  const { data: songs = [], isLoading } = useSongs()
  const createSong = useCreateSong()
  const user = useAuthStore((s) => s.user)
  const [newName, setNewName] = useState('')
  const { active, steps, start, complete, skip, shouldAutoStart } = useAppTour()

  useEffect(() => {
    if (shouldAutoStart) start()
  }, [shouldAutoStart, start])

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createSong.mutate(newName.trim(), { onSuccess: () => setNewName('') })
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-shell-muted">{getGreeting()}, {user?.name ?? 'there'}</p>
          <h1 className="mt-1 text-2xl font-semibold text-shell-text">What do you want to make today?</h1>
        </div>
        <form onSubmit={handleCreate} className="flex gap-2 sm:shrink-0">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New song name…" size="sm" />
          <Button type="submit" variant="primary" size="sm" rounded loading={createSong.isPending} disabled={!newName.trim()}>
            + New Song
          </Button>
        </form>
      </div>
      <SongGrid songs={songs} isLoading={isLoading} />
      {active && <TourOverlay steps={steps} onComplete={complete} onSkip={skip} />}
    </AppShell>
  )
}
