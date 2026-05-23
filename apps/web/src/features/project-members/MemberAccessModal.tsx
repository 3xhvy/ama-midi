import { useMemo, useState } from 'react'
import { Button, Modal, SearchSelect, ToggleGroup } from '../../components/ui'
import { useAddProjectMember } from './useProjectMembers'
import { useUserSearch } from './useUserSearch'
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
  excludeUserIds = [],
  onClose,
}: {
  projectId: string
  songs: Song[]
  excludeUserIds?: string[]
  onClose: () => void
}) {
  const addMember = useAddProjectMember(projectId)
  const [userQuery, setUserQuery] = useState('')
  const { data: users = [], isLoading: usersLoading } = useUserSearch(userQuery)
  const [userId, setUserId] = useState('')
  const [permission, setPermission] = useState<ProjectPermission>('READ')
  const [songScope, setSongScope] = useState<SongScope>('NO_SONGS')
  const [songIds, setSongIds] = useState<string[]>([])

  const userOptions = useMemo(
    () => users
      .filter((user) => !excludeUserIds.includes(user.id))
      .map((user) => ({
        value: user.id,
        label: user.name,
        description: user.email,
      })),
    [excludeUserIds, users],
  )

  const songOptions = useMemo(
    () => songs.map((song) => ({
      value: song.id,
      label: song.name,
    })),
    [songs],
  )

  const valid = useMemo(() => {
    if (!userId) return false
    if (songScope === 'SELECTED_SONGS') return songIds.length > 0
    return true
  }, [songIds.length, songScope, userId])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    addMember.mutate(
      { userId, permission, songScope, songIds: songScope === 'SELECTED_SONGS' ? songIds : undefined },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content className="max-w-md">
        <Modal.Header onClose={onClose}>Add Project Member</Modal.Header>
        <Modal.Body>
          <form id="member-access-form" onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>User</span>
              <SearchSelect
                options={userOptions}
                value={userId}
                onChange={(value) => setUserId(typeof value === 'string' ? value : value[0] ?? '')}
                onSearchChange={setUserQuery}
                placeholder="Select a user"
                searchPlaceholder="Search by name or email"
                emptyMessage="No users found"
                loading={usersLoading}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>Permission</span>
              <ToggleGroup items={PERMISSIONS} value={permission} onValueChange={(v) => setPermission(v as ProjectPermission)} />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>Song scope</span>
              <ToggleGroup items={SCOPES} value={songScope} onValueChange={(v) => setSongScope(v as SongScope)} />
            </div>
            {songScope === 'SELECTED_SONGS' && (
              <div className="space-y-1.5">
                <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>Songs</span>
                <SearchSelect
                  multiple
                  options={songOptions}
                  value={songIds}
                  onChange={(value) => setSongIds(Array.isArray(value) ? value : value ? [value] : [])}
                  placeholder="Select songs"
                  searchPlaceholder="Search songs"
                  emptyMessage="No songs in this project"
                />
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
