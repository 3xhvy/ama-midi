import { toast } from 'sonner'
import type { ChartApplyPreview, NoteSuggestion } from '@ama-midi/shared'
import { useEditorStore } from '../../../../store/editor.store'
import { suggestionsToChartNotes } from '../chart-merge-apply'

export { fetchSuggestionChartPreview, suggestionsToChartNotes } from '../chart-merge-apply'

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
  toast.success('Chart preview ready — apply from the bar above when ready')
  closeAiAssistant()
}
