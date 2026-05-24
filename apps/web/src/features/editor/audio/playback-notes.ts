import type { Note } from '@ama-midi/shared'

/** Notes whose time falls in (prevTime, currentTime] should trigger once. */
export function notesCrossedByPlayhead(
  notes: Note[],
  prevTime: number,
  currentTime: number,
  mutedTracks: Set<number>,
): Note[] {
  if (currentTime <= prevTime) return []
  return notes.filter(
    (n) => !mutedTracks.has(n.track) && n.time > prevTime && n.time <= currentTime,
  )
}
