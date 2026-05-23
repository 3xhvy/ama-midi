import {
  getSongTemplate,
  SongCategoryEnum,
  SongDifficultyEnum,
  SUPPORTED_TIME_SIGNATURES,
  type ImportSongOptions,
  type SongCategory,
  type SongDifficulty,
} from '@ama-midi/shared'

export type WizardStep = 'start' | 'setup' | 'assignment' | 'review'
export type StartType = 'BLANK' | 'TEMPLATE' | 'IMPORT'
export type ImportMode = 'structure' | 'pattern' | 'full' | 'custom'

export interface SetupFields {
  name: string
  category: SongCategory
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
}

export function validateStartStep(
  startType: StartType,
  templateId: string | null,
  importOptions: ImportSongOptions | null,
): string | null {
  if (startType === 'IMPORT' && !importOptions?.sourceSongId) return 'Choose a source song'
  if (startType === 'TEMPLATE' && !templateId) return 'Choose a template'
  return null
}

export function validateSetupStep(fields: { name: string; bpm: number; timeSignature: string }): string | null {
  if (!fields.name.trim()) return 'Song name is required'
  if (fields.bpm < 40 || fields.bpm > 300) return 'BPM must be between 40 and 300'
  if (!SUPPORTED_TIME_SIGNATURES.includes(fields.timeSignature as (typeof SUPPORTED_TIME_SIGNATURES)[number])) {
    return 'Choose a supported time signature'
  }
  return null
}

export function applyTemplateDefaults(templateId: string): SetupFields {
  const tpl = getSongTemplate(templateId)
  if (!tpl) throw new Error(`Unknown template: ${templateId}`)
  return {
    name: tpl.suggestedName,
    category: tpl.category,
    difficulty: tpl.difficulty,
    bpm: tpl.bpm,
    timeSignature: tpl.timeSignature,
  }
}

export function importModeToOptions(mode: ImportMode): Omit<ImportSongOptions, 'sourceSongId'> {
  switch (mode) {
    case 'structure':
      return { copySettings: true, copySections: true, copyPatterns: false, copyNotes: false }
    case 'pattern':
      return { copySettings: true, copySections: true, copyPatterns: true, copyNotes: false }
    case 'full':
      return { copySettings: true, copySections: true, copyPatterns: true, copyNotes: true }
    case 'custom':
      return { copySettings: true, copySections: true, copyPatterns: false, copyNotes: false }
  }
}

export function getImportModeFromOptions(opts: ImportSongOptions): ImportMode {
  const { copySettings, copySections, copyPatterns, copyNotes } = opts
  if (copySettings && copySections && !copyPatterns && !copyNotes) return 'structure'
  if (copySettings && copySections && copyPatterns && !copyNotes) return 'pattern'
  if (copySettings && copySections && copyPatterns && copyNotes) return 'full'
  return 'custom'
}

export function buildReviewSummary(input: {
  startType: StartType
  templateId?: string | null
  templateName?: string | null
  importSourceName?: string | null
  name: string
  category: SongCategory
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
  composerName?: string | null
  qaName?: string | null
}) {
  const startLine =
    input.startType === 'BLANK'
      ? 'Blank song'
      : input.startType === 'TEMPLATE'
        ? `Template: ${input.templateName ?? input.templateId}`
        : `Import from: "${input.importSourceName ?? 'Unknown'}"`

  const detailsLine = `${input.name} · ${SongCategoryEnum.label(input.category)} · ${SongDifficultyEnum.label(input.difficulty)} · ${input.bpm} BPM · ${input.timeSignature}`

  return { startLine, detailsLine }
}

export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: 'start', label: 'Start' },
  { id: 'setup', label: 'Setup' },
  { id: 'assignment', label: 'Assignment' },
  { id: 'review', label: 'Review' },
]
