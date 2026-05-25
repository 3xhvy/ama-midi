import type {
  ApplyChartResponse,
  ChartApplyPreview,
  ConflictAction,
  GeneratedChartNote,
  NoteSuggestion,
} from '@ama-midi/shared'
import { apiClient } from '../../auth/api'
import type { DraftTapNote } from '../../../store/editor.store'

export function suggestionsToChartNotes(suggestions: NoteSuggestion[]): GeneratedChartNote[] {
  return suggestions.map((s) => ({ track: s.track, time: s.time, title: '' }))
}

export async function fetchSuggestionChartPreview(
  token: string | null,
  songId: string,
  chartId: string,
  suggestions: NoteSuggestion[],
): Promise<ChartApplyPreview> {
  return fetchMergePreview(token, songId, chartId, suggestionsToChartNotes(suggestions))
}

export function tapDraftsToChartNotes(drafts: DraftTapNote[], offset = 0): GeneratedChartNote[] {
  return drafts.map((draft) => ({
    track:    draft.track,
    time:     Math.round((draft.time + offset) * 100) / 100,
    noteType: draft.duration != null && draft.duration > 0 ? 'HOLD' : 'TAP',
    duration: draft.duration,
    title:    '',
  }))
}

export async function fetchMergePreview(
  token: string | null,
  songId: string,
  chartId: string,
  notes: GeneratedChartNote[],
): Promise<ChartApplyPreview> {
  return apiClient(token)<ChartApplyPreview>(
    `/songs/${songId}/charts/${chartId}/preview-chart`,
    {
      method: 'POST',
      body: JSON.stringify({ notes, replaceExisting: false }),
    },
  )
}

export async function applyMergeWithResolutions(
  token: string | null,
  songId: string,
  chartId: string,
  notes: GeneratedChartNote[],
  placement: ChartApplyPreview,
  resolutions: Record<string, ConflictAction>,
): Promise<ApplyChartResponse> {
  return apiClient(token)<ApplyChartResponse>(
    `/songs/${songId}/apply-chart`,
    {
      method: 'POST',
      body: JSON.stringify({
        chartId,
        notes,
        replaceExisting: false,
        previewVersion: placement.previewVersion,
        resolutions: placement.conflicts.map((c) => ({
          conflictId: c.conflictId,
          action: resolutions[c.conflictId] ?? 'KEEP_EXISTING',
        })),
      }),
    },
  )
}

export function mergeApplyToast(result: ApplyChartResponse) {
  const skipped = result.skippedCount > 0 ? `, skipped ${result.skippedCount}` : ''
  return `Added ${result.createdCount} notes, replaced ${result.replacedCount}${skipped}`
}
