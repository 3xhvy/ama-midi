import {
  SONG_TEMPLATES,
  SongCategoryEnum,
  SongDifficultyEnum,
  type ImportSongOptions,
  type Song,
} from '@ama-midi/shared'
import { Badge, Button } from '../../../../components/ui'
import { cn } from '../../../../lib/utils'
import { ImportSongStep } from '../ImportSongStep'
import type { StartType } from '../wizard-logic'

const START_OPTIONS: { value: StartType; title: string; description: string }[] = [
  { value: 'BLANK', title: 'Blank song', description: 'Empty chart with your settings' },
  {
    value: 'TEMPLATE',
    title: 'From template',
    description: 'Preset sections, patterns, or starter notes',
  },
  {
    value: 'IMPORT',
    title: 'Import from song',
    description: 'Copy settings and chart data from an existing song',
  },
]

export interface StartStepProps {
  startType: StartType
  templateId: string | null
  importOptions: ImportSongOptions
  setupTouched: boolean
  pendingTemplateId: string | null
  songs: Song[]
  projectNames: Record<string, string>
  onStartTypeChange: (type: StartType) => void
  onTemplateSelect: (id: string) => void
  onTemplateOverwriteChoice: (choice: 'keep' | 'apply') => void
  onImportChange: (opts: ImportSongOptions) => void
}

export function StartStep({
  startType,
  templateId,
  importOptions,
  setupTouched,
  pendingTemplateId,
  songs,
  projectNames,
  onStartTypeChange,
  onTemplateSelect,
  onTemplateOverwriteChoice,
  onImportChange,
}: StartStepProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-shell-text">How do you want to start?</h3>

      <div className="grid gap-2">
        {START_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onStartTypeChange(opt.value)}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              startType === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-shell-border hover:border-shell-muted',
            )}
          >
            <p className="text-sm font-medium text-shell-text">{opt.title}</p>
            <p className="mt-0.5 text-xs text-shell-muted">{opt.description}</p>
          </button>
        ))}
      </div>

      {startType === 'TEMPLATE' && (
        <div className="space-y-3">
          {pendingTemplateId && setupTouched && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-shell-text">
                Apply template defaults to name, category, difficulty, and BPM?
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onTemplateOverwriteChoice('keep')}
                >
                  Keep my edits
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onTemplateOverwriteChoice('apply')}
                >
                  Apply defaults
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {SONG_TEMPLATES.map((tpl) => {
              const selected = templateId === tpl.id
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onTemplateSelect(tpl.id)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-shell-border hover:border-shell-muted',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-shell-text">{tpl.name}</p>
                    <Badge size="sm" variant="muted" className="shrink-0">
                      {tpl.createsLabel}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-shell-muted">{tpl.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge size="sm" variant="default">
                      {SongCategoryEnum.label(tpl.category)}
                    </Badge>
                    <Badge size="sm" variant="default">
                      {SongDifficultyEnum.label(tpl.difficulty)}
                    </Badge>
                    <Badge size="sm" variant="default">
                      {tpl.bpm} BPM
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {startType === 'IMPORT' && (
        <ImportSongStep
          songs={songs}
          projectNames={projectNames}
          value={importOptions}
          onChange={onImportChange}
        />
      )}
    </div>
  )
}
