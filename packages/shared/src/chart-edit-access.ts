import type { SongStatus, UserRole } from './types'
import { isSongChartReadOnly } from './song-status-workflow'

export type ChartReadOnlyReason = 'platform_viewer' | 'project_read' | 'published' | 'archived'

export const CHART_READ_ONLY_MESSAGES: Record<ChartReadOnlyReason, string> = {
  platform_viewer: 'Your account has view-only access — you cannot edit charts.',
  project_read: 'You have read-only access to this project — you cannot add or change notes.',
  published: 'This song is published — the chart is read-only.',
  archived: 'This song is archived — the chart is read-only.',
}

export function resolveChartEditAccess(input: {
  isPlatformAdmin: boolean
  platformRole: UserRole
  projectPermission: 'READ' | 'EDIT' | 'ADMIN' | null
  songStatus: SongStatus
}): { canEditChart: boolean; readOnlyReason: ChartReadOnlyReason | null } {
  if (input.isPlatformAdmin) {
    if (isSongChartReadOnly(input.songStatus)) {
      return {
        canEditChart: false,
        readOnlyReason: input.songStatus === 'ARCHIVED' ? 'archived' : 'published',
      }
    }
    return { canEditChart: true, readOnlyReason: null }
  }

  if (input.platformRole === 'VIEWER') {
    return { canEditChart: false, readOnlyReason: 'platform_viewer' }
  }

  if (!input.projectPermission || input.projectPermission === 'READ') {
    return { canEditChart: false, readOnlyReason: 'project_read' }
  }

  if (isSongChartReadOnly(input.songStatus)) {
    return {
      canEditChart: false,
      readOnlyReason: input.songStatus === 'ARCHIVED' ? 'archived' : 'published',
    }
  }

  return { canEditChart: true, readOnlyReason: null }
}
