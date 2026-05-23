import type { Note } from '@ama-midi/shared'

/** Normalised note density per track (0–1) from the full song — not the viewport. */
export function computeTrackDensity(
  notes: Note[],
  trackCount = 8,
): Record<number, number> {
  const counts: Record<number, number> = {}
  for (let t = 1; t <= trackCount; t++) counts[t] = 0
  for (const note of notes) {
    if (note.track >= 1 && note.track <= trackCount) counts[note.track]++
  }

  const max = Math.max(...Object.values(counts), 1)
  const density: Record<number, number> = {}
  for (const [track, count] of Object.entries(counts)) {
    density[Number(track)] = count / max
  }
  return density
}

/** Minimum bar width (6%) so empty tracks remain visible. */
export function trackBarWidth(density: number): number {
  return Math.max(density, 0.06)
}
