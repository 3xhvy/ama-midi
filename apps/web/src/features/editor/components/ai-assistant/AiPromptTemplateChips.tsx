import {
  templatesForFlow,
  type AiPromptFlow,
} from '@ama-midi/shared'

interface Props {
  flow: AiPromptFlow
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  improveSubMode?: 'extend' | 'refine'
}

export function AiPromptTemplateChips({
  flow,
  value,
  onChange,
  disabled = false,
  improveSubMode,
}: Props) {
  const templates = templatesForFlow(flow, improveSubMode)
  if (templates.length === 0) return null

  const activeTemplate = templates.find((template) => template.prompt === value) ?? null

  return (
    <div className="space-y-1.5">
      <p className="ai-flow-section-label text-[10px] uppercase tracking-wide">
        Quick starts
      </p>
      <div className="ai-prompt-chips">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={disabled}
            aria-pressed={activeTemplate?.id === template.id}
            className={`ai-prompt-chip${activeTemplate?.id === template.id ? ' ai-prompt-chip--active' : ''}`}
            onClick={() => onChange(template.prompt)}
          >
            {template.label}
          </button>
        ))}
      </div>
      {activeTemplate?.hint ? (
        <p className="ai-flow-label-hint text-[10px] leading-snug">{activeTemplate.hint}</p>
      ) : null}
    </div>
  )
}
