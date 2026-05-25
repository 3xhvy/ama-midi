import type { AiChartContext } from '@ama-midi/shared'

export type ChartPromptMode = 'generate_replace' | 'generate_merge' | 'generate_new_chart' | 'scale' | 'suggest'

const OCCUPIED_LABEL = 'Occupied slots (never duplicate track+time):'
const REFERENCE_LABEL = 'Reference chart notes (include in your full output when they fit the brief):'

export function resolveGenerateMode(input: {
  replaceExisting: boolean
  createAsNewChart?: boolean
  useReferenceChart?: boolean
}): ChartPromptMode {
  if (input.createAsNewChart && input.useReferenceChart) return 'generate_new_chart'
  if (input.replaceExisting) return 'generate_replace'
  return 'generate_merge'
}

export const CHART_NOTE_TYPE_INSTRUCTIONS = [
  'Note types: TAP (instant hit) and HOLD (sustained — MUST include duration in seconds).',
  'Always use uppercase noteType: "TAP" or "HOLD". Never use SWIPE or other types.',
  'Mix note types in every chart: use HOLD for vocals, pads, bass sustains, and long accents (aim for roughly 15–35% HOLD unless the brief is explicitly tap-only).',
  'Typical HOLD duration: 0.3–3.0 seconds, snapped to the grid like note times.',
].join(' ')

export const CHART_JSON_EXAMPLE =
  '{"notes":[{"track":1,"time":0.0,"noteType":"TAP","title":"Kick"},{"track":2,"time":1.0,"noteType":"HOLD","duration":1.2,"title":"Pad"}],"sections":[{"time":0,"label":"Intro","color":"#10B981"}]}'

export function serializeChartContextForPrompt(
  ctx: AiChartContext,
  options: { mode: ChartPromptMode; snapHint: string; maxNotes?: number; includeReferenceNotes?: boolean },
): string {
  const maxNotes = options.maxNotes ?? 200
  const truncated = ctx.notes.length > maxNotes
  const notesForPrompt = truncated ? ctx.notes.slice(0, maxNotes) : ctx.notes
  const omitted = truncated ? ctx.notes.length - maxNotes : 0
  const includeReferenceNotes = options.includeReferenceNotes ?? true

  return [
    `Song: "${ctx.song.name}", ${ctx.song.bpm} BPM, ${ctx.song.timeSignature}, category ${ctx.song.category}.`,
    `Chart: "${ctx.chart.name}", ${ctx.chart.noteCount} notes, ${ctx.chart.computedDifficulty}, speed ${ctx.chart.speedMultiplier.toFixed(1)}x, avg score ${ctx.chart.averageDifficultyScore.toFixed(1)}, peak ${ctx.chart.peakDifficultyScore.toFixed(1)}.`,
    includeReferenceNotes
      ? `Current notes (chronological): ${JSON.stringify(notesForPrompt)}.`
      : null,
    includeReferenceNotes && omitted > 0 ? `(${omitted} additional notes omitted...)` : null,
    includeReferenceNotes ? `Sections: ${JSON.stringify(ctx.sections)}.` : null,
    includeReferenceNotes ? `Density segments: ${JSON.stringify(ctx.segments)}.` : null,
    includeReferenceNotes ? `Warnings: ${JSON.stringify(ctx.warnings)}.` : null,
    includeReferenceNotes
      ? options.mode === 'generate_new_chart'
        ? `${REFERENCE_LABEL} ${JSON.stringify(ctx.occupied)}.`
        : `${OCCUPIED_LABEL} ${JSON.stringify(ctx.occupied)}.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')
}

export function buildGeneratePrompt(input: {
  ctx: AiChartContext
  description: string
  snapHint: string
  targetCount: number
  targetTier?: string
  replaceExisting: boolean
  createAsNewChart?: boolean
  useReferenceChart?: boolean
}): { system: string; user: string } {
  const mode = resolveGenerateMode(input)
  const includeReferenceNotes = !(input.createAsNewChart && !input.useReferenceChart)
  const contextBlock = serializeChartContextForPrompt(input.ctx, {
    mode,
    snapHint: input.snapHint,
    includeReferenceNotes,
  })

  const system = [
    'You are a rhythm-game chart designer for AMA-MIDI.',
    'Charts use 8 lanes (tracks 1–8), timeline 0–300 seconds.',
    CHART_NOTE_TYPE_INSTRUCTIONS,
    'Return ONLY valid JSON with keys "notes" and "sections". No markdown.',
  ].join(' ')

  const task = mode === 'generate_new_chart'
    ? `New chart from reference: generate a complete standalone chart for a new empty chart (~${input.targetCount} notes, ~0–300s). Use the reference chart for style, density, lane usage, and structure — include its notes in your output when they fit the brief (reuse, adapt, extend, or replace as needed). Return the FULL chart timeline, not a patch or delta. The reference chart itself is not modified.`
    : mode === 'generate_replace'
      ? `Complete replacement: generate approximately ${input.targetCount} notes for the whole chart (~0–300s). Preserve musical structure where it fits the brief.`
      : `Add to the chart: return ONLY new notes (do not repeat existing notes from context). Never place a note on an occupied track+time slot. Aim for roughly ${input.targetCount} new notes unless the brief clearly specifies otherwise.`

  const user = [
    contextBlock,
    input.targetTier ? `Target difficulty tier hint: ${input.targetTier} (not persisted — match density to this tier).` : null,
    `Snap all times to ${input.snapHint}. One note per track+time (no overlaps).`,
    `Composer brief: ${input.description}`,
    task,
    `Also suggest 3–6 section markers when they clarify structure.`,
    `JSON shape: ${CHART_JSON_EXAMPLE}`,
  ]
    .filter(Boolean)
    .join(' ')

  return { system, user }
}
