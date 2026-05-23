export function parseTimeDeltaDraft(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '.' || trimmed === '-' || trimmed === '+') return null

  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed)) return null

  return Number(parsed.toFixed(1))
}

export function formatTimeDelta(value: number): string {
  const rounded = Number(value.toFixed(1))
  return rounded >= 0 ? `+${rounded.toFixed(1)}` : rounded.toFixed(1)
}

export function sanitizeTimeDeltaDraft(value: string): string {
  const trimmed = value.trim()
  const isNegative = trimmed.startsWith('-')
  const isPositive = trimmed.startsWith('+')
  const sign = isNegative ? '-' : isPositive ? '+' : ''
  const numeric = trimmed.replace(/^[-+]/, '').replace(/[^\d.]/g, '')
  const [whole = '', ...decimalParts] = numeric.split('.')
  const decimal = decimalParts.join('')
  const wholeWithoutLeadingZeroes = whole.replace(/^0+(?=\d)/, '')

  if (numeric.startsWith('.')) return `${sign || '+'}0.${decimal}`
  if (!numeric.includes('.')) {
    const wholePart = wholeWithoutLeadingZeroes.replace(/^0+$/, '0')
    return `${sign || (wholePart === '0' && !isNegative ? '+' : sign)}${wholePart}`
  }
  if (wholeWithoutLeadingZeroes === '') return `${sign || '+'}0.${decimal}`

  return `${sign}${wholeWithoutLeadingZeroes}.${decimal}`
}

export function stepTimeDeltaDraft(value: string, direction: 1 | -1): string {
  const parsed = parseTimeDeltaDraft(value)
  const base = parsed ?? 0
  return formatTimeDelta(base + direction * 0.1)
}

export function validateTrackTarget(
  targetTrack: number,
  minTrack: number,
  maxTrack: number,
): string | null {
  if (!Number.isInteger(targetTrack) || targetTrack < 1 || targetTrack > 8) {
    return 'Target track must be between 1 and 8'
  }

  const span = maxTrack - minTrack
  const maxTarget = 8 - span

  if (targetTrack > maxTarget) {
    return `Target track must be ${maxTarget} or lower for this selection`
  }

  return null
}
