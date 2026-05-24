import { useEffect, useMemo, useState } from 'react'
import type { ProjectMember, ProjectPermission, Song, SongScope } from '@ama-midi/shared'
import { Button, Modal, SearchSelect, ToggleGroup } from '../../components/ui'
import { MEMBER_PERMISSION_OPTIONS, MEMBER_SCOPE_OPTIONS } from './member-access-options'
import { useUpdateProjectMember } from './useProjectMembers'

export function EditMemberAccessModal({
  member,
  projectId,
  songs,
  open,
  onOpenChange,
}: {
  member: ProjectMember | null
  projectId: string
  songs: Song[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateMember = useUpdateProjectMember(projectId)
  const [permission, setPermission] = useState<ProjectPermission>('READ')
  const [songScope, setSongScope] = useState<SongScope>('NO_SONGS')
  const [songIds, setSongIds] = useState<string[]>([])

  useEffect(() => {
    if (!member) return
    setPermission(member.permission)
    setSongScope(member.songScope)
    setSongIds(member.selectedSongIds)
  }, [member])

  const songOptions = useMemo(
    () => songs.map((song) => ({
      value: song.id,
      label: song.name,
    })),
    [songs],
  )

  const valid = useMemo(() => {
    if (songScope === 'SELECTED_SONGS') return songIds.length > 0
    return true
  }, [songIds.length, songScope])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!member || !valid) return
    updateMember.mutate(
      {
        memberId: member.id,
        permission,
        songScope,
        songIds: songScope === 'SELECTED_SONGS' ? songIds : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  if (!member) return null

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content className="max-w-md">
        <Modal.Header onClose={() => onOpenChange(false)}>Edit member access</Modal.Header>
        <Modal.Body>
          <form id="edit-member-access-form" onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>Member</span>
              <p className="rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-sm text-shell-text">
                {member.userName}
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>Permission</span>
              <ToggleGroup
                items={[...MEMBER_PERMISSION_OPTIONS]}
                value={permission}
                onValueChange={(v) => setPermission(v as ProjectPermission)}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>Song scope</span>
              <ToggleGroup
                items={[...MEMBER_SCOPE_OPTIONS]}
                value={songScope}
                onValueChange={(v) => setSongScope(v as SongScope)}
              />
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
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-member-access-form"
            size="sm"
            disabled={!valid}
            loading={updateMember.isPending}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
