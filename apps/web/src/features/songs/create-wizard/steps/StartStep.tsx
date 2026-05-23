import {
  SONG_TEMPLATES,
  SongCategoryEnum,
  type ImportSongOptions,
  type Song,
} from '@ama-midi/shared'
import {
  DownloadIcon,
  FileIcon,
  QuestionMarkCircledIcon,
  StackIcon,
} from '@radix-ui/react-icons'
import { Badge, Button, Tooltip } from '../../../../components/ui'
import { cn } from '../../../../lib/utils'
import { ImportSongStep } from '../ImportSongStep'
import type { StartType } from '../wizard-logic'

const START_OPTIONS: {
  value: StartType
  title: string
  description: string
  Icon: typeof FileIcon
}[] = [
  {
    value: 'BLANK',
    title: 'Blank song',
    description: 'Empty chart with your settings',
    Icon: FileIcon,
  },
  {
    value: 'TEMPLATE',
    title: 'From template',
    description: 'Preset sections, patterns, or starter notes',
    Icon: StackIcon,
  },
  {
    value: 'IMPORT',
    title: 'Import from song',
    description: 'Copy settings and chart data from an existing song',
    Icon: DownloadIcon,
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

      <div className="grid grid-cols-3 gap-2">
        {START_OPTIONS.map((opt) => {
          const selected = startType === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStartTypeChange(opt.value)}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-lg border p-3 pt-4 text-center transition-colors',
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-shell-border hover:border-shell-muted',
              )}
            >
              <Tooltip content={opt.description} side="top">
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`About ${opt.title}`}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
                  }}
                  className="absolute right-1.5 top-1.5 inline-flex rounded-sm text-shell-muted hover:text-shell-text"
                >
                  <QuestionMarkCircledIcon className="h-3.5 w-3.5" />
                </span>
              </Tooltip>
              <opt.Icon
                className={cn('h-5 w-5', selected ? 'text-primary' : 'text-shell-muted')}
              />
              <span className="text-xs font-medium leading-tight text-shell-text">{opt.title}</span>
            </button>
          )
        })}
      </div>

      {(startType === 'TEMPLATE' || startType === 'IMPORT') && (
        <div className="border-t border-shell-border pt-4">
          {startType === 'TEMPLATE' && (
            <div className="space-y-3">
              {pendingTemplateId && setupTouched && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs text-shell-text">
                    Apply template defaults to name, category, and BPM?
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
      )}
    </div>
  )
}
