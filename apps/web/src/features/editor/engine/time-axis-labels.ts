export interface TimeAxisLabel {
  time:        number
  y:           number
  label:       string
  isWholeSecond: boolean
}

export interface TimeGridLine {
  time:  number
  y:     number
  weight: 'measure' | 'subdivision'
}

const MIN_LABEL_PX = 24
const CANDIDATE_STEPS = [0.1, 0.25, 0.5, 1, 2, 4, 5, 10, 15, 20, 30, 60]

export function getTimeAxisStep(pxPerSecond: number): number {
  return CANDIDATE_STEPS.find((step) => step * pxPerSecond >= MIN_LABEL_PX) ?? 60
}

export function formatTimeAxisLabel(time: number): string {
  return `${Number(time.toFixed(2))}s`
}

export function getTimeAxisLabels(
  pxPerSecond: number,
  scrollTop: number,
  timeMax: number,
): TimeAxisLabel[] {
  const step = getTimeAxisStep(pxPerSecond)
  const labels: TimeAxisLabel[] = []
  const count = Math.floor(timeMax / step)

  for (let i = 0; i <= count; i += 1) {
    const time = Number((i * step).toFixed(2))
    labels.push({
      time,
      y:             time * pxPerSecond - scrollTop,
      label:         formatTimeAxisLabel(time),
      isWholeSecond: Number.isInteger(time),
    })
  }

  return labels
}

export function getVisibleTimeGridLines(
  pxPerSecond: number,
  timeFrom: number,
  timeTo: number,
): TimeGridLine[] {
  const step = getTimeAxisStep(pxPerSecond)
  const start = Math.max(0, Math.floor(timeFrom / step) * step)
  const end = Math.min(timeTo, Math.ceil(timeTo / step) * step)
  const lines: TimeGridLine[] = []

  for (let time = start; time <= end + 0.0001; time = Number((time + step).toFixed(2))) {
    const rounded = Number(time.toFixed(2))
    lines.push({
      time: rounded,
      y:    rounded * pxPerSecond,
      weight: Number.isInteger(rounded) ? 'measure' : 'subdivision',
    })
  }

  return lines
}
