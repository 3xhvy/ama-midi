export type SnapMode = '0.1s' | 'beat' | 'halfBeat'

export function beatDuration(bpm: number): number {
  return 60 / bpm
}

export function measureDuration(bpm: number, timeSignature: string): number {
  const [beats] = timeSignature.split('/').map(Number)
  return beatDuration(bpm) * beats
}

export function snapTime(rawTime: number, mode: SnapMode, bpm: number): number {
  if (mode === '0.1s') return Math.round(rawTime * 10) / 10
  const bd = beatDuration(bpm)
  const div = mode === 'beat' ? bd : bd / 2
  return Math.round(rawTime / div) * div
}
