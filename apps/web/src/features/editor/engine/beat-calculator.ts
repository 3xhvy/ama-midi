export type SnapMode = '0.1s' | 'beat' | 'halfBeat'

export function beatDuration(bpm: number): number {
  return 60 / bpm
}

export function measureDuration(bpm: number, timeSignature: string): number {
  const [beats] = timeSignature.split('/').map(Number)
  return beatDuration(bpm) * beats
}

export function timeToBeat(
  time: number, bpm: number, timeSignature = '4/4',
): { measure: number; beat: number } {
  const [beatsPerMeasure] = timeSignature.split('/').map(Number)
  const bd     = beatDuration(bpm)
  const total  = Math.floor(time / bd)
  return {
    measure: Math.floor(total / beatsPerMeasure) + 1,
    beat:    (total % beatsPerMeasure) + 1,
  }
}

export function beatToTime(measure: number, beat: number, bpm: number, beatsPerMeasure = 4): number {
  return ((measure - 1) * beatsPerMeasure + (beat - 1)) * beatDuration(bpm)
}

export function snapTime(rawTime: number, mode: SnapMode, bpm: number): number {
  if (mode === '0.1s') return Math.round(rawTime * 10) / 10
  const bd  = beatDuration(bpm)
  const div = mode === 'beat' ? bd : bd / 2
  return Math.round(rawTime / div) * div
}
