import { useEditorStore } from '../../../../store/editor.store'

export function AiAssistantTrigger() {
  const openAiAssistant = useEditorStore((s) => s.openAiAssistant)

  return (
    <button
      type="button"
      data-tour="ai-suggest"
      onClick={() =>
        openAiAssistant({ open: true, feature: null, phase: 'picker', entry: 'toolbar' })
      }
      className="editor-toolbar-suggest flex items-center gap-1 mr-1"
    >
      AI
    </button>
  )
}
