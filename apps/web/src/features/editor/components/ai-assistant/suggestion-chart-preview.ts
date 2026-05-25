import { toast } from 'sonner'
import type { ChartApplyPreview, NoteSuggestion } from '@ama-midi/shared'
import { apiClient } from '../../../auth/api'
import { useEditorStore } from '../../../../store/editor.store'

export function suggestionsToChartNotes(suggestions: NoteSuggestion[]) {
  return suggestions.map((s) => ({ track: s.track, time: s.time }))
}

export async function fetchSuggestionChartPreview(
  token: string | null,
  songId: string,
  chartId: string,
  suggestions: NoteSuggestion[],
): Promise<ChartApplyPreview> {
  return apiClient(token)<ChartApplyPreview>(
    `/songs/${songId}/charts/${chartId}/preview-chart`,
    {
      method: 'POST',
      body: JSON.stringify({
        notes: suggestionsToChartNotes(suggestions),
        replaceExisting: false,
      }),
    },
  )
}

export function openSuggestionChartPreview(
  suggestions: NoteSuggestion[],
  placement: ChartApplyPreview,
) {
  const { setChartPreview, closeAiAssistant } = useEditorStore.getState()
  setChartPreview({
    notes: suggestionsToChartNotes(suggestions),
    replaceExisting: false,
    placement,
  })
  toast.success('Chart preview ready — review and apply in the bar above')
  closeAiAssistant()
}
