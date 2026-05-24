import { useEditorStore } from '../../../../store/editor.store'

function AiSparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path
        fill="currentColor"
        d="M8 1.5 9 5 12.5 6 9 7 8 10.5 7 7 3.5 6 7 5 8 1.5z"
      />
      <path
        fill="currentColor"
        opacity="0.75"
        d="M12.5 9l.75 2.25L15.5 12l-2.25.75L12.5 15l-.75-2.25L9.5 12l2.25-.75L12.5 9z"
      />
    </svg>
  )
}

export function AiAssistantTrigger() {
  const openAiAssistant = useEditorStore((s) => s.openAiAssistant)

  return (
    <button
      type="button"
      data-tour="ai-suggest"
      title="Open AI Assistant"
      onClick={() =>
        openAiAssistant({ open: true, feature: null, phase: 'picker', entry: 'toolbar' })
      }
      className="editor-toolbar-ai flex items-center gap-1.5"
    >
      <AiSparkleIcon />
      <span>AI</span>
    </button>
  )
}
