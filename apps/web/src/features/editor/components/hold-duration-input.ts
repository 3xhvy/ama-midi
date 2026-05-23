export const HOLD_DURATION_MIN = 0.1
export const HOLD_DURATION_MAX = 30
export const HOLD_DURATION_STEP = 0.1

export interface HoldEndAtValue {
  endAt: number
  duration: number
}

function formatTenths(value: number): string {
  return String(Number(value.toFixed(1)))
}

export function clampHoldDuration(value: number): number {
  if (!Number.isFinite(value)) return HOLD_DURATION_MIN
  const clamped = Math.min(HOLD_DURATION_MAX, Math.max(HOLD_DURATION_MIN, value))
  return Number(clamped.toFixed(1))
}

export function sanitizeHoldDurationDraft(value: string): string {
  const numeric = value.replace(/[^\d.]/g, '')
  const [whole = '', ...decimalParts] = numeric.split('.')
  const decimal = decimalParts.join('')
  const wholeWithoutLeadingZeroes = whole.replace(/^0+(?=\d)/, '')

  if (numeric.startsWith('.')) return `0.${decimal}`
  if (!numeric.includes('.')) return wholeWithoutLeadingZeroes.replace(/^0+$/, '')
  if (wholeWithoutLeadingZeroes === '') return `0.${decimal}`

  return `${wholeWithoutLeadingZeroes}.${decimal}`
}

export function parseHoldDurationDraft(value: string): number | null {
  if (!value || value === '.') return null

  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < HOLD_DURATION_MIN) return null

  return clampHoldDuration(parsed)
}

export function stepHoldDurationDraft(value: string, direction: 1 | -1): string {
  const parsed = parseHoldDurationDraft(value)
  const base = parsed ?? (direction > 0 ? HOLD_DURATION_MIN - HOLD_DURATION_STEP : HOLD_DURATION_MIN)

  return formatTenths(clampHoldDuration(base + direction * HOLD_DURATION_STEP))
}

export function getHoldEndDraft(startAt: number, duration?: number): string {
  const nextDuration = clampHoldDuration(duration ?? HOLD_DURATION_MIN)

  return formatTenths(startAt + nextDuration)
}

export function parseHoldEndAtDraft(startAt: number, value: string): HoldEndAtValue | null {
  if (!value || value === '.') return null

  const parsedEndAt = Number.parseFloat(value)
  if (!Number.isFinite(parsedEndAt)) return null

  const rawDuration = parsedEndAt - startAt
  if (rawDuration < HOLD_DURATION_MIN || rawDuration > HOLD_DURATION_MAX) return null

  const duration = clampHoldDuration(rawDuration)

  return {
    endAt:    formatTimeValue(startAt + duration),
    duration,
  }
}

export function stepHoldEndAtDraft(startAt: number, value: string, direction: 1 | -1): string {
  const parsed = parseHoldEndAtDraft(startAt, value)
  const baseEndAt = parsed?.endAt ?? startAt + HOLD_DURATION_MIN - (direction > 0 ? HOLD_DURATION_STEP : 0)

  return formatTenths(startAt + clampHoldDuration(baseEndAt - startAt + direction * HOLD_DURATION_STEP))
}

export function formatTimeValue(value: number): number {
  return Number(value.toFixed(1))
}
