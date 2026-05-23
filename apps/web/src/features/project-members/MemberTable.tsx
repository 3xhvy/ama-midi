import { useState } from 'react'
import { Button } from '../../components/ui'
import { useProjectMembers } from './useProjectMembers'
import { MemberAccessModal } from './MemberAccessModal'
import type { Song } from '@ama-midi/shared'

export function MemberTable({ projectId, songs }: { projectId: string; songs: Song[] }) {
  const { data: members = [] } = useProjectMembers(projectId)
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" rounded onClick={() => setOpen(true)}>Add Member</Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-shell-border bg-shell-surface">
        <table className="w-full text-sm">
          <thead className="bg-shell-bg text-xs uppercase text-shell-muted">
            <tr>
              <th className="px-3 py-2 text-left">Member</th>
              <th className="px-3 py-2 text-left">Permission</th>
              <th className="px-3 py-2 text-left">Scope</th>
              <th className="px-3 py-2 text-right">Selected</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-shell-border">
                <td className="px-3 py-2 text-shell-text">{member.userName}</td>
                <td className="px-3 py-2 text-shell-muted">{member.permission}</td>
                <td className="px-3 py-2 text-shell-muted">{member.songScope}</td>
                <td className="px-3 py-2 text-right text-shell-muted">{member.selectedSongIds.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <MemberAccessModal
          projectId={projectId}
          songs={songs}
          excludeUserIds={members.map((member) => member.userId)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
