import { useMemo, useState } from 'react'
import { Button, Modal, ToggleGroup } from '../../components/ui'
import { useAddProjectMember } from './useProjectMembers'
import type { ProjectPermission, Song, SongScope } from '@ama-midi/shared'

const PERMISSIONS = [
  { value: 'READ', label: 'Read' },
  { value: 'EDIT', label: 'Edit' },
  { value: 'ADMIN', label: 'Admin' },
]

const SCOPES = [
  { value: 'ALL_SONGS', label: 'All' },
  { value: 'SELECTED_SONGS', label: 'Selected' },
  { value: 'NO_SONGS', label: 'None' },
]

export function MemberAccessModal({
  projectId,
  songs,
  onClose,
}: {
  projectId: string
  songs: Song[]
  onClose: () => void
}) {
  const addMember = useAddProjectMember(projectId)
  const [userId, setUserId] = useState('')
  const [permission, setPermission] = useState<ProjectPermission>('READ')
  const [songScope, setSongScope] = useState<SongScope>('NO_SONGS')
  const [songIds, setSongIds] = useState<string[]>([])

  const valid = useMemo(() => {
    if (!userId.trim()) return false
    if (songScope === 'SELECTED_SONGS') return songIds.length > 0
    return true
  }, [songIds.length, songScope, userId])

  function toggleSong(songId: string) {
    setSongIds((prev) => prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId])
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    addMember.mutate(
      { userId: userId.trim(), permission, songScope, songIds: songScope === 'SELECTED_SONGS' ? songIds : undefined },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header onClose={onClose}>Add Project Member</Modal.Header>
        <Modal.Body>
          <form id="member-access-form" onSubmit={submit} className="space-y-4">
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User id"
              className="w-full rounded-md border border-shell-border bg-shell-bg px-3 py-2 text-sm text-shell-text"
            />
            <div className="space-y-1.5">
              <span className="text-xs text-shell-muted">Permission</span>
              <ToggleGroup items={PERMISSIONS} value={permission} onValueChange={(v) => setPermission(v as ProjectPermission)} />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-shell-muted">Song scope</span>
              <ToggleGroup items={SCOPES} value={songScope} onValueChange={(v) => setSongScope(v as SongScope)} />
            </div>
            {songScope === 'SELECTED_SONGS' && (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-shell-border p-2">
                {songs.map((song) => (
                  <label key={song.id} className="flex items-center gap-2 text-sm text-shell-text">
                    <input type="checkbox" checked={songIds.includes(song.id)} onChange={() => toggleSong(song.id)} />
                    {song.name}
                  </label>
                ))}
              </div>
            )}
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button type="submit" form="member-access-form" disabled={!valid} loading={addMember.isPending}>Add</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
