/** Pentatonic-ish frequencies per lane (tracks 1–8). */
export const TRACK_FREQUENCIES: Record<number, number> = {
  1: 261.63, // C4
  2: 293.66, // D4
  3: 329.63, // E4
  4: 392.0,  // G4
  5: 440.0,  // A4
  6: 523.25, // C5
  7: 587.33, // D5
  8: 659.25, // E5
}

export function trackFrequency(track: number): number {
  return TRACK_FREQUENCIES[track] ?? TRACK_FREQUENCIES[1]
}
