import type { NavigateFunction } from 'react-router-dom'
import type { DashboardFeed, Project, Song, SongChart } from '@ama-midi/shared'
import { apiClient } from '../auth/api'
import { songEditorPath } from '../navigation/song-editor-path'
import { useEditorStore } from '../../store/editor.store'

export type TourPhase = 'project' | 'song' | 'user' | 'editor' | 'analysis'

export interface TourContextData {
  projectId?: string
  songId?: string
  chartId?: string
}

export interface TourRuntimeContext extends TourContextData {
  navigate: NavigateFunction
  editorStore: Pick<
    ReturnType<typeof useEditorStore.getState>,
    | 'setLeftCollapsed'
    | 'setRightCollapsed'
    | 'setRightPanelTab'
    | 'closeAiAssistant'
    | 'openAiAssistant'
  >
}

export function editorRoute(ctx: TourContextData): string | undefined {
  if (!ctx.projectId || !ctx.songId) return undefined
  return songEditorPath(ctx.projectId, ctx.songId)
}

export function projectRoute(ctx: TourContextData): string | undefined {
  if (!ctx.projectId) return undefined
  return `/projects/${ctx.projectId}`
}

export function analysisBoardRoute(ctx: TourContextData): string | undefined {
  if (!ctx.projectId || !ctx.songId || !ctx.chartId) return undefined
  return `/projects/${ctx.projectId}/songs/${ctx.songId}/charts/${ctx.chartId}/analysis`
}

export async function resolveTourContext(token: string): Promise<TourContextData> {
  const dashboard = await apiClient(token)<DashboardFeed>('/dashboard')
  const recent =
    dashboard.recentSongs[0]
    ?? dashboard.assignedToMe[0]
    ?? dashboard.needsReview[0]

  let projectId = recent?.projectId
  let songId = recent?.id

  if (!projectId) {
    const projects = await apiClient(token)<Project[]>('/projects')
    projectId = projects.find((p) => p.status === 'ACTIVE')?.id ?? projects[0]?.id
  }

  if (projectId && !songId) {
    const songs = await apiClient(token)<Song[]>(`/projects/${projectId}/songs`)
    songId = songs[0]?.id
  }

  let chartId: string | undefined
  if (songId) {
    const charts = await apiClient(token)<SongChart[]>(`/songs/${songId}/charts`)
    chartId = charts[0]?.id
  }

  return { projectId, songId, chartId }
}

export function buildRuntimeContext(
  data: TourContextData,
  navigate: NavigateFunction,
): TourRuntimeContext {
  const editor = useEditorStore.getState()
  return {
    ...data,
    navigate,
    editorStore: {
      setLeftCollapsed: editor.setLeftCollapsed,
      setRightCollapsed: editor.setRightCollapsed,
      setRightPanelTab: editor.setRightPanelTab,
      closeAiAssistant: editor.closeAiAssistant,
      openAiAssistant: editor.openAiAssistant,
    },
  }
}

export const SETTLE_MS = 200
export const ROUTE_SETTLE_MS = 380
export const PREPARE_SETTLE_MS = 120
export const ANALYSIS_SETTLE_MS = 700

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
