import type { ReactNode } from 'react'
import {
  getSongTemplate,
  SongCategoryEnum,
  type ImportSongOptions,
  type SongCategory,
} from '@ama-midi/shared'
import { SongStatusBadge } from '../../../../components/ui'
import {
  buildReviewSummary,
  getImportModeFromOptions,
  type StartType,
} from '../wizard-logic'

const IMPORT_MODE_LABELS: Record<ReturnType<typeof getImportModeFromOptions>, string> = {
  structure: 'Structure only',
  pattern: 'Pattern starter',
  full: 'Full duplicate',
  custom: 'Custom',
}

function importCopyGroups(opts: ImportSongOptions): string {
  const groups: string[] = []
  if (opts.copySettings) groups.push('Settings')
  if (opts.copySections) groups.push('Sections')
  if (opts.copyPatterns) groups.push('Patterns')
  if (opts.copyNotes) groups.push('Notes')
  return groups.join(', ') || 'None'
}

function ReviewSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-shell-muted">{title}</h4>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-shell-muted">{label}</dt>
      <dd className="text-right text-shell-text">{value}</dd>
    </div>
  )
}

export interface ReviewStepProps {
  startType: StartType
  templateId?: string | null
  templateName?: string | null
  importSourceName?: string | null
  importOptions?: ImportSongOptions | null
  name: string
  category: SongCategory
  bpm: number
  timeSignature: string
  composerName?: string | null
  qaName?: string | null
}

export function ReviewStep({
  startType,
  templateId,
  templateName,
  importSourceName,
  importOptions,
  name,
  category,
  bpm,
  timeSignature,
  composerName,
  qaName,
}: ReviewStepProps) {
  const summary = buildReviewSummary({
    startType,
    templateId,
    templateName,
    importSourceName,
    name,
    category,
    bpm,
    timeSignature,
    composerName,
    qaName,
  })

  const template = templateId ? getSongTemplate(templateId) : undefined
  const importMode =
    startType === 'IMPORT' && importOptions ? getImportModeFromOptions(importOptions) : null

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-shell-text">Review and create</h3>

      <div className="space-y-4 rounded-lg border border-shell-border bg-shell-bg/50 p-4">
        <ReviewSection title="Start">
          <ReviewRow label="Method" value={summary.startLine} />
        </ReviewSection>

        <ReviewSection title="Details">
          <ReviewRow label="Name" value={name} />
          <ReviewRow label="Category" value={SongCategoryEnum.label(category)} />
          <ReviewRow label="Difficulty" value="Computed from chart" />
          <ReviewRow label="BPM" value={bpm} />
          <ReviewRow label="Time signature" value={timeSignature} />
        </ReviewSection>

        <ReviewSection title="Team">
          <ReviewRow label="Composer" value={composerName ?? 'Unassigned'} />
          <ReviewRow label="QA reviewer" value={qaName ?? 'Unassigned'} />
          <ReviewRow
            label="Status"
            value={<SongStatusBadge status="DRAFT" />}
          />
        </ReviewSection>

        {startType === 'IMPORT' && importOptions && (
          <ReviewSection title="Import options">
            <ReviewRow label="Source song" value={importSourceName ?? 'Unknown'} />
            <ReviewRow
              label="Import mode"
              value={importMode ? IMPORT_MODE_LABELS[importMode] : '—'}
            />
            {importMode === 'custom' && (
              <ReviewRow label="Copy groups" value={importCopyGroups(importOptions)} />
            )}
          </ReviewSection>
        )}

        {startType === 'TEMPLATE' && template && (
          <ReviewSection title="Template">
            <ReviewRow label="Template" value={templateName ?? template.name} />
            <ReviewRow label="Creates" value={template.createsLabel} />
          </ReviewSection>
        )}
      </div>
    </div>
  )
}
