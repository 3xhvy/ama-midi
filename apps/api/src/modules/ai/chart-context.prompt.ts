import type { AiChartContext } from '@ama-midi/shared'

export type ChartPromptMode = 'generate_replace' | 'generate_merge' | 'scale' | 'suggest'

const OCCUPIED_LABEL = 'Occupied slots (never duplicate track+time):'

export function serializeChartContextForPrompt(
  ctx: AiChartContext,
  options: { mode: ChartPromptMode; snapHint: string; maxNotes?: number },
): string {
  const maxNotes = options.maxNotes ?? 200
  const truncated = ctx.notes.length > maxNotes
  const notesForPrompt = truncated ? ctx.notes.slice(0, maxNotes) : ctx.notes
  const omitted = truncated ? ctx.notes.length - maxNotes : 0

  return [
    `Song: "${ctx.song.name}", ${ctx.song.bpm} BPM, ${ctx.song.timeSignature}, category ${ctx.song.category}.`,
    `Chart: "${ctx.chart.name}", ${ctx.chart.noteCount} notes, ${ctx.chart.computedDifficulty}, speed ${ctx.chart.speedMultiplier.toFixed(1)}x, avg score ${ctx.chart.averageDifficultyScore.toFixed(1)}, peak ${ctx.chart.peakDifficultyScore.toFixed(1)}.`,
    `Current notes (chronological): ${JSON.stringify(notesForPrompt)}.`,
    omitted > 0 ? `(${omitted} additional notes omitted...)` : null,
    `Sections: ${JSON.stringify(ctx.sections)}.`,
    `Density segments: ${JSON.stringify(ctx.segments)}.`,
    `Warnings: ${JSON.stringify(ctx.warnings)}.`,
    `${OCCUPIED_LABEL} ${JSON.stringify(ctx.occupied)}.`,
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
}): { system: string; user: string } {
  const mode: ChartPromptMode = input.replaceExisting ? 'generate_replace' : 'generate_merge'
  const contextBlock = serializeChartContextForPrompt(input.ctx, { mode, snapHint: input.snapHint })

  const system = [
    'You are a rhythm-game chart designer for AMA-MIDI.',
    'Charts use 8 lanes (tracks 1–8), timeline 0–300 seconds.',
    'Note types: TAP (default), HOLD (requires duration in seconds), SWIPE.',
    'Return ONLY valid JSON with keys "notes" and "sections". No markdown.',
  ].join(' ')

  const task = input.replaceExisting
    ? `Complete replacement: generate approximately ${input.targetCount} notes for the whole chart (~0–300s). Preserve musical structure where it fits the brief.`
    : `Complement the chart: return the full merged chart including all existing notes unchanged alongside your additions. Never duplicate an occupied track+time slot. Aim for roughly ${input.targetCount} additional notes unless the brief clearly specifies otherwise.`

  const user = [
    contextBlock,
    input.targetTier ? `Target difficulty tier hint: ${input.targetTier} (not persisted — match density to this tier).` : null,
    `Snap all times to ${input.snapHint}. One note per track+time (no overlaps).`,
    `Composer brief: ${input.description}`,
    task,
    `Also suggest 3–6 section markers when they clarify structure.`,
    `JSON shape: {"notes":[{"track":1,"time":0.0,"noteType":"TAP","title":"Kick"}],"sections":[{"time":0,"label":"Intro","color":"#10B981"}]}`,
    `HOLD notes must include duration. Keep titles short.`,
  ]
    .filter(Boolean)
    .join(' ')

  return { system, user }
}
