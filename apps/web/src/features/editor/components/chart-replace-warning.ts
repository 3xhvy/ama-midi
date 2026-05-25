export function confirmReplaceEntireChart(existingNoteCount?: number): boolean {
  const scope =
    existingNoteCount != null && existingNoteCount > 0
      ? `All ${existingNoteCount} notes on this chart and every section marker will be deleted.`
      : 'Every note on this chart and all section markers will be deleted.'

  return window.confirm(
    `${scope}\n\nThis is destructive — the chart is only restored if you undo afterward. Review the AI preview before continuing.\n\nReplace the entire chart?`,
  )
}
