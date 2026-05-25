import type { AiChartContext } from '@ama-midi/shared'
import {
  buildGeneratePrompt,
  serializeChartContextForPrompt,
  CHART_NOTE_TYPE_INSTRUCTIONS,
} from '../chart-context.prompt'

function makeCtx(noteCount: number): AiChartContext {
  const notes = Array.from({ length: noteCount }, (_, i) => ({
    track: (i % 8) + 1,
    time: i * 0.05,
    noteType: 'TAP' as const,
    title: `n${i}`,
  }))
  return {
    song: {
      name: 'Synth Test',
      bpm: 128,
      timeSignature: '4/4',
      category: 'EDM',
    },
    chart: {
      id: 'chart-x',
      name: 'Expert',
      noteCount,
      computedDifficulty: 'INSANE',
      speedMultiplier: 1.25,
      averageDifficultyScore: 42.5,
      peakDifficultyScore: 88.9,
      updatedAt: '2026-05-24T00:00:00.000Z',
    },
    notes,
    sections: [{ time: 0, label: 'Intro', color: '#111111' }],
    segments: [
      { start: 0, end: 10, nps: 9, level: 'HARD', score: 41 },
      { start: 10, end: 20, nps: 10, level: 'HARD', score: 44 },
    ],
    warnings: [{ code: 'W1', severity: 'info', message: 'Thin intro' }],
    occupied: notes.map((n) => ({ track: n.track, time: n.time })),
  }
}

const OCC_LABEL = 'Occupied slots (never duplicate track+time):'
const REF_LABEL = 'Reference chart notes (include in your full output when they fit the brief):'

describe('serializeChartContextForPrompt', () => {
  it('truncates notes but preserves full occupied list (250 notes, maxNotes 200)', () => {
    const ctx = makeCtx(250)
    const text = serializeChartContextForPrompt(ctx, {
      mode: 'generate_merge',
      snapHint: '0.05s grid',
      maxNotes: 200,
    })

    expect(text).toContain('(50 additional notes omitted...)')

    const occPart = text.split(OCC_LABEL)[1]?.trim()
    expect(occPart).toBeDefined()
    expect(occPart?.endsWith('.')).toBe(true)
    const jsonStr = occPart!.slice(0, occPart!.length - 1)
    const occupied = JSON.parse(jsonStr!) as unknown[]
    expect(occupied).toHaveLength(250)
  })

  it('does not truncate when notes.length ≤ maxNotes', () => {
    const ctx = makeCtx(50)
    const text = serializeChartContextForPrompt(ctx, {
      mode: 'generate_replace',
      snapHint: 'beats',
      maxNotes: 200,
    })

    expect(text).not.toContain('additional notes omitted')
    const occPart = text.split(OCC_LABEL)[1]?.trim()!
    const jsonStr = occPart.slice(0, occPart.length - 1)
    expect(JSON.parse(jsonStr)).toHaveLength(50)
  })
})

describe('buildGeneratePrompt', () => {
  it('matches designer system prompt and varies task for replace vs merge', () => {
    const ctx = makeCtx(3)
    const base = buildGeneratePrompt({
      ctx,
      description: 'Chiptune duel',
      snapHint: '0.05s steps',
      targetCount: 120,
      targetTier: undefined,
      replaceExisting: false,
    })

    expect(base.system).toBe(
      [
        'You are a rhythm-game chart designer for AMA-MIDI.',
        'Charts use 8 lanes (tracks 1–8), timeline 0–300 seconds.',
        CHART_NOTE_TYPE_INSTRUCTIONS,
        'Return ONLY valid JSON with keys "notes" and "sections". No markdown.',
      ].join(' '),
    )

    expect(base.user).toContain('ONLY new notes')
    expect(base.user).toContain('Never place a note on an occupied')
    expect(base.user).not.toContain('full merged chart')

    const rep = buildGeneratePrompt({
      ctx,
      description: 'Rebuild',
      snapHint: '0.05s steps',
      targetCount: 200,
      replaceExisting: true,
    })

    expect(rep.user).toContain('Complete replacement')
    expect(rep.user).not.toContain('ONLY new notes')
    expect(rep.user).not.toContain('Target difficulty tier hint')
    const withTier = buildGeneratePrompt({
      ctx,
      description: 'X',
      snapHint: '0.05s steps',
      targetCount: 99,
      targetTier: 'BRUTAL',
      replaceExisting: true,
    })
    expect(withTier.user).toContain('BRUTAL')
  })

  it('asks for a full chart and includes reference notes when creating a new chart from reference', () => {
    const ctx = makeCtx(3)
    const prompt = buildGeneratePrompt({
      ctx,
      description: 'Harder doubles in chorus',
      snapHint: '0.05s steps',
      targetCount: 120,
      replaceExisting: false,
      createAsNewChart: true,
      useReferenceChart: true,
    })

    expect(prompt.user).toContain('New chart from reference')
    expect(prompt.user).toContain('FULL chart timeline')
    expect(prompt.user).toContain('include its notes in your output')
    expect(prompt.user).toContain(REF_LABEL)
    expect(prompt.user).not.toContain('ONLY new notes')
    expect(prompt.user).not.toContain(OCC_LABEL)
  })

  it('omits reference notes when creating a new chart without reference', () => {
    const ctx = makeCtx(3)
    const prompt = buildGeneratePrompt({
      ctx,
      description: 'Fresh chiptune chart',
      snapHint: '0.05s steps',
      targetCount: 90,
      replaceExisting: true,
      createAsNewChart: true,
      useReferenceChart: false,
    })

    expect(prompt.user).toContain('Complete replacement')
    expect(prompt.user).not.toContain('Current notes (chronological)')
    expect(prompt.user).not.toContain(OCC_LABEL)
    expect(prompt.user).not.toContain(REF_LABEL)
  })
})
