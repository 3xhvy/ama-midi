import { Pencil1Icon } from '@radix-ui/react-icons'
import { useState } from 'react'
import type { ProjectMember, Song } from '@ama-midi/shared'
import { Button, IconButton } from '../../components/ui'
import { EditMemberAccessModal } from './EditMemberAccessModal'
import { MemberAccessModal } from './MemberAccessModal'
import { useProjectMembers } from './useProjectMembers'

export function MemberTable({ projectId, songs }: { projectId: string; songs: Song[] }) {
  const { data: members = [] } = useProjectMembers(projectId)
  const [addOpen, setAddOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null)

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" rounded onClick={() => setAddOpen(true)}>Add Member</Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-shell-border bg-shell-surface">
          <table className="w-full text-sm">
            <thead className="bg-shell-bg text-xs uppercase text-shell-muted">
              <tr>
                <th className="px-3 py-2 text-left">Member</th>
                <th className="px-3 py-2 text-left">Permission</th>
                <th className="px-3 py-2 text-left">Scope</th>
                <th className="px-3 py-2 text-right">Selected</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-shell-border hover:bg-shell-bg">
                  <td className="px-3 py-2 text-shell-text">{member.userName}</td>
                  <td className="px-3 py-2 text-shell-muted">{member.permission}</td>
                  <td className="px-3 py-2 text-shell-muted">{member.songScope}</td>
                  <td className="px-3 py-2 text-right text-shell-muted">{member.selectedSongIds.length}</td>
                  <td className="px-3 py-2 text-right">
                    <IconButton
                      size="sm"
                      variant="outlined"
                      tooltip="Edit access"
                      aria-label="Edit access"
                      onClick={() => setEditingMember(member)}
                    >
                      <Pencil1Icon className="h-3.5 w-3.5" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {addOpen && (
          <MemberAccessModal
            projectId={projectId}
            songs={songs}
            excludeUserIds={members.map((member) => member.userId)}
            onClose={() => setAddOpen(false)}
          />
        )}
      </div>

      <EditMemberAccessModal
        member={editingMember}
        projectId={projectId}
        songs={songs}
        open={!!editingMember}
        onOpenChange={(open) => { if (!open) setEditingMember(null) }}
      />
    </>
  )
}
