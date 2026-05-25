import type { SongChart } from '@ama-midi/shared'

export function ensureUniqueChartName(base: string, charts: SongChart[]): string {
  const trimmed = base.trim().slice(0, 60)
  if (!trimmed) return nextAiChartName(charts)
  if (!charts.some((chart) => chart.name === trimmed)) return trimmed
  let n = 2
  while (charts.some((chart) => chart.name === `${trimmed} ${n}`)) n++
  return `${trimmed} ${n}`
}

export function nextAiChartName(charts: SongChart[]): string {
  return ensureUniqueChartName('AI Chart', charts)
}

export function suggestAiChartName(
  sections: Array<{ label: string }> | undefined,
  description: string | undefined,
  charts: SongChart[],
): string {
  const sectionLabel = sections?.map((section) => section.label.trim()).find(Boolean)
  const fromDescription = description?.trim().replace(/\s+/g, ' ').slice(0, 48).trim()

  const base = sectionLabel
    ? sectionLabel
    : fromDescription && fromDescription.length >= 3
      ? fromDescription
      : 'AI Chart'

  return ensureUniqueChartName(base, charts)
}
