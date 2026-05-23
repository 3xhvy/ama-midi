export const PATTERN_PASTE_TIME_MIN = 0
export const PATTERN_PASTE_TIME_MAX = 300
export const PATTERN_PASTE_TIME_STEP = 0.1

export function formatPatternPasteTime(value: number): string {
  const clamped = clampPatternPasteTime(value)
  return clamped.toFixed(1)
}

export function sanitizePatternPasteTimeDraft(value: string): string {
  const trimmed = value.trim()
  const isNegative = trimmed.startsWith('-')
  const numeric = trimmed.replace(/[^\d.]/g, '')
  const [whole = '', ...decimalParts] = numeric.split('.')
  const decimal = decimalParts.join('')
  const wholeWithoutLeadingZeroes = whole.replace(/^0+(?=\d)/, '')

  if (numeric.startsWith('.')) return `${isNegative ? '-' : ''}0.${decimal}`
  if (!numeric.includes('.')) return `${isNegative ? '-' : ''}${wholeWithoutLeadingZeroes.replace(/^0+$/, '0')}`
  if (wholeWithoutLeadingZeroes === '') return `${isNegative ? '-' : ''}0.${decimal}`

  return `${isNegative ? '-' : ''}${wholeWithoutLeadingZeroes}.${decimal}`
}

export function parsePatternPasteTimeDraft(value: string): number | null {
  if (!value || value === '.' || value === '-') return null

  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return null

  return clampPatternPasteTime(parsed)
}

export function stepPatternPasteTimeDraft(value: string, direction: 1 | -1): string {
  const parsed = parsePatternPasteTimeDraft(value)
  const base = parsed ?? (direction > 0 ? PATTERN_PASTE_TIME_MIN : PATTERN_PASTE_TIME_MIN + PATTERN_PASTE_TIME_STEP)
  return formatPatternPasteTime(base + direction * PATTERN_PASTE_TIME_STEP)
}

function clampPatternPasteTime(value: number): number {
  if (!Number.isFinite(value)) return PATTERN_PASTE_TIME_MIN
  const clamped = Math.min(PATTERN_PASTE_TIME_MAX, Math.max(PATTERN_PASTE_TIME_MIN, value))
  return Number(clamped.toFixed(1))
}
