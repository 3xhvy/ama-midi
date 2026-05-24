import { measureDuration, type Note } from '@ama-midi/shared'

export const MAX_REPEAT_GENERATED_NOTES = 500

export function formatRepeatInterval(value: number): string {
  return Number(value.toFixed(1)).toFixed(1)
}

export function sanitizeRepeatCountDraft(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  return digits === '0' ? '' : digits
}

export function parseRepeatCountDraft(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1) return null
  return parsed
}

export function sanitizeRepeatIntervalDraft(value: string): string {
  const numeric = value.replace(/[^\d.]/g, '')
  const [whole = '', ...decimalParts] = numeric.split('.')
  const decimal = decimalParts.join('')
  const wholeWithoutLeadingZeroes = whole.replace(/^0+(?=\d)/, '')

  if (numeric.startsWith('.')) return `0.${decimal}`
  if (!numeric.includes('.')) return wholeWithoutLeadingZeroes.replace(/^0+$/, '0')
  if (wholeWithoutLeadingZeroes === '') return `0.${decimal}`

  return `${wholeWithoutLeadingZeroes}.${decimal}`
}

export function parseRepeatIntervalDraft(value: string): number | null {
  const parsed = Number.parseFloat(value.trim())
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Number(parsed.toFixed(1))
}

export function getSelectionLengthInterval(notes: Pick<Note, 'time'>[]): number {
  if (notes.length < 2) return 0.1
  const times = notes.map((note) => note.time)
  return Math.max(0.1, Number((Math.max(...times) - Math.min(...times)).toFixed(1)))
}

export function getRepeatDefaults(
  _notes: Pick<Note, 'time'>[],
  bpm: number,
  timeSignature: string,
): { repeatCountDraft: string; repeatIntervalDraft: string } {
  return {
    repeatCountDraft: '3',
    repeatIntervalDraft: formatRepeatInterval(measureDuration(bpm, timeSignature)),
  }
}

export function validateRepeatRequest(
  notes: Pick<Note, 'id'>[],
  repeatCount: number | null,
  repeatInterval: number | null,
): string | null {
  if (repeatCount == null) return 'Enter at least 1 copy'
  if (repeatInterval == null) return 'Enter an interval greater than 0.0s'

  const generated = notes.length * repeatCount
  if (generated > MAX_REPEAT_GENERATED_NOTES) {
    return `Repeat would create ${generated} notes; limit is ${MAX_REPEAT_GENERATED_NOTES}`
  }

  return null
}
