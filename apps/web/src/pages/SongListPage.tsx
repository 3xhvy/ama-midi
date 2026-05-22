import { useState } from 'react'
import { AppShell } from '../components/layout'
import { Button, Input } from '../components/ui'
import { SongGrid } from '../features/songs/SongGrid'
import { useSongs, useCreateSong } from '../features/songs/useSongs'

export function SongListPage() {
  const { data: songs = [], isLoading } = useSongs()
  const createSong = useCreateSong()
  const [newName, setNewName] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createSong.mutate(newName.trim(), { onSuccess: () => setNewName('') })
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-shell-text">My Songs</h1>
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New song name…" size="sm" />
          <Button type="submit" variant="primary" size="sm" rounded loading={createSong.isPending} disabled={!newName.trim()}>
            + New Song
          </Button>
        </form>
      </div>
      <SongGrid songs={songs} isLoading={isLoading} />
    </AppShell>
  )
}
