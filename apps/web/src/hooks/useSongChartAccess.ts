import { CHART_READ_ONLY_MESSAGES, isSongChartReadOnly } from '@ama-midi/shared'
import { useCanEdit } from './useCanEdit'
import { useSongWorkflow } from '../features/songs/useSongWorkflow'

export function useSongChartAccess(songId?: string, song?: { status: import('@ama-midi/shared').SongStatus } | null) {
  const platformCanEdit = useCanEdit()
  const { data: workflow, isLoading } = useSongWorkflow(songId)

  const statusReadOnly = song ? isSongChartReadOnly(song.status) : false

  const canEdit = workflow
    ? workflow.canEditChart
    : platformCanEdit && !!song && !statusReadOnly

  const readOnlyMessage = workflow?.readOnlyReason
    ? CHART_READ_ONLY_MESSAGES[workflow.readOnlyReason]
    : !platformCanEdit
      ? CHART_READ_ONLY_MESSAGES.platform_viewer
      : statusReadOnly && song
        ? CHART_READ_ONLY_MESSAGES[song.status === 'ARCHIVED' ? 'archived' : 'published']
        : null

  return { canEdit, readOnlyMessage, isLoading }
}
