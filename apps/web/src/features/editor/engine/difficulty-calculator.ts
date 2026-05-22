import type { Note } from '@ama-midi/shared'

export function computeNpsOverTime(
  notes: Note[], windowSeconds = 2, resolution = 0.5,
): Array<{ time: number; nps: number }> {
  const result: Array<{ time: number; nps: number }> = []
  for (let t = 0; t <= 300; t = +(t + resolution).toFixed(3)) {
    const count = notes.filter(
      n => n.time >= t - windowSeconds / 2 && n.time < t + windowSeconds / 2,
    ).length
    result.push({ time: t, nps: count / windowSeconds })
  }
  return result
}

export function npsToColor(nps: number): string {
  if (nps < 3) return 'rgba(16, 185, 129, 0.15)'
  if (nps < 6) return 'rgba(245, 158, 11, 0.20)'
  return 'rgba(239, 68, 68, 0.25)'
}

export function maxCombo(notes: Note[]): number {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  let max = 0, streak = 0, last = -Infinity
  for (const n of sorted) {
    if (n.time - last <= 2) { streak++; max = Math.max(max, streak) }
    else                     { streak = 1; max = Math.max(max, streak) }
    last = n.time
  }
  return max
}

export type DifficultyRating = 'Easy' | 'Normal' | 'Hard' | 'Expert'

export function difficultyRating(notes: Note[]): DifficultyRating {
  if (notes.length === 0) return 'Easy'
  const avgNps = notes.length / 300
  if (avgNps < 2) return 'Easy'
  if (avgNps < 4) return 'Normal'
  if (avgNps < 7) return 'Hard'
  return 'Expert'
}
