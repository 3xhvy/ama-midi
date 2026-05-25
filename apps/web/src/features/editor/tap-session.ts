import { TIME_MAX } from '@ama-midi/shared'
import type { PatternNote } from '@ama-midi/shared'
import type { SnapMode } from './engine/beat-calculator'
import { snapTime } from './engine/beat-calculator'
import type { LoopRange, DraftTapNote } from '../../store/editor.store'
import type { Note } from '@ama-midi/shared'

export const DEFAULT_LOOP_SECONDS = 8

/** Create an 8s loop window anchored at the playhead when none exists yet. */
export function createDefaultLoopRange(
  playheadTime: number,
  snapMode: SnapMode,
  bpm: number,
): LoopRange {
  const start = snapTime(playheadTime, snapMode, bpm)
  let end = Math.min(
    Math.round((start + DEFAULT_LOOP_SECONDS) * 100) / 100,
    TIME_MAX,
  )
  if (end <= start + 0.1) {
    end = Math.min(Math.round((start + 0.1) * 100) / 100, TIME_MAX)
    const adjustedStart = Math.max(0, Math.round((end - DEFAULT_LOOP_SECONDS) * 100) / 100)
    return { start: adjustedStart, end }
  }
  return { start, end }
}

/** Copy chart notes inside a loop window into tap draft slots. */
export function seedDraftFromNotes(notes: Note[], range: LoopRange): DraftTapNote[] {
  return notes
    .filter((n) => n.time >= range.start && n.time < range.end)
    .map((n) => ({
      track:    n.track,
      time:     n.time,
      duration: n.noteType === 'HOLD' && n.duration != null && n.duration > 0
        ? n.duration
        : undefined,
    }))
}

/** Convert tap draft notes to library pattern notes (offsets from earliest tap). */
export function draftTapNotesToPatternNotes(drafts: DraftTapNote[]): PatternNote[] {
  if (drafts.length === 0) return []
  const earliest = Math.min(...drafts.map((d) => d.time))
  return drafts.map((d) => ({
    track:      d.track,
    timeOffset: Math.round((d.time - earliest) * 100) / 100,
    noteType:   d.duration != null && d.duration > 0 ? 'HOLD' : 'TAP',
    duration:   d.duration,
  }))
}
