import { beatDuration } from './beat-calculator'

export interface BeatLine {
  y:      number
  weight: 'beat' | 'measure'
}

export function computeBeatLines(
  timeFrom: number, timeTo: number,
  bpm: number, timeSignature: string, pxPerSecond: number,
): BeatLine[] {
  const bd                = beatDuration(bpm)
  const [beatsPerMeasure] = timeSignature.split('/').map(Number)
  const startBeat = Math.max(0, Math.floor(timeFrom / bd))
  const endBeat   = Math.ceil(timeTo / bd)
  const lines: BeatLine[] = []
  for (let i = startBeat; i <= endBeat; i++) {
    lines.push({
      y:      i * bd * pxPerSecond,
      weight: i % beatsPerMeasure === 0 ? 'measure' : 'beat',
    })
  }
  return lines
}
