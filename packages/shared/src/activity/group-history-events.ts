import type { EditorEventRow } from '../events'

const BURST_THRESHOLD = 4
const WINDOW_MS = 30_000

export type GroupedHistoryItem =
  | { kind: 'event'; event: EditorEventRow }
  | {
      kind: 'burst'
      id: string
      actor: EditorEventRow['user']
      events: EditorEventRow[]
      total: number
      createdAt: string
    }

function withinWindow(newest: EditorEventRow, candidate: EditorEventRow) {
  return new Date(newest.createdAt).getTime() - new Date(candidate.createdAt).getTime() <= WINDOW_MS
}

export function groupHistoryEvents(events: EditorEventRow[]): GroupedHistoryItem[] {
  const seen = new Set<string>()
  const unique = events.filter(event => {
    if (seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })

  const result: GroupedHistoryItem[] = []
  let i = 0

  while (i < unique.length) {
    const first = unique[i]
    const group = [first]
    let j = i + 1

    while (j < unique.length && unique[j].userId === first.userId && withinWindow(first, unique[j])) {
      group.push(unique[j])
      j += 1
    }

    if (group.length >= BURST_THRESHOLD) {
      result.push({
        kind: 'burst',
        id: `burst-${first.userId}-${first.id}`,
        actor: first.user,
        events: group,
        total: group.length,
        createdAt: first.createdAt,
      })
    } else {
      group.forEach(event => result.push({ kind: 'event', event }))
    }

    i = j
  }

  return result
}
